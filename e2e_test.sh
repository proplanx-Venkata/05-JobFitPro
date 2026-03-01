#!/usr/bin/env bash
BASE="http://localhost:3000"
RESUME_PDF="D:/Ved-Data/Claude/05-JobFitPro/test_resume.pdf"
JD_PDF="D:/Ved-Data/Claude/05-JobFitPro/test_jd.pdf"
COOKIE_JAR="D:/Ved-Data/Claude/05-JobFitPro/jfp_cookies.txt"
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'

pass() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; echo "  Response: $(echo "$2" | head -c 300)"; exit 1; }
info() { echo -e "${YELLOW}→ $1${NC}"; }
# All curl calls go through here — never causes set -e to fire
jq() { python3 -c "import sys,json; d=json.load(sys.stdin); $1" 2>/dev/null; }

# ──────────────────────────────────────────────
# STEP 0: Signup
# ──────────────────────────────────────────────
info "STEP 0: Signup"
EMAIL="test_$(date +%s)@example.com"
PASSWORD="TestPass123!"
R=$(curl -s -c "$COOKIE_JAR" -X POST "$BASE/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"full_name\":\"Test User\"}" 2>/dev/null || echo "")
USER_ID=$(echo "$R" | jq "print(d['data']['user']['id'])")
[ -z "$USER_ID" ] && fail "Signup failed" "$R"
echo "  user_id: $USER_ID"
pass "Signup OK -> $EMAIL"

# STEP 1: Login
info "STEP 1: Login"
R=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" 2>/dev/null || echo "")
SESSION_CHECK=$(echo "$R" | jq "print('ok' if d.get('data',{}).get('session') else 'no')")
[ "$SESSION_CHECK" != "ok" ] && fail "Login failed" "$R"
pass "Login OK"

# STEP 2: GET /api/auth/me
info "STEP 2: GET /api/auth/me"
R=$(curl -s -b "$COOKIE_JAR" "$BASE/api/auth/me" 2>/dev/null || echo "")
PROFILE=$(echo "$R" | jq "print(d['data']['profile']['full_name'])")
[ -z "$PROFILE" ] && fail "/me failed" "$R"
echo "  profile: $PROFILE"
pass "/api/auth/me OK"

# STEP 3: Upload resume
info "STEP 3: Upload resume"
R=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE/api/resumes" \
  -F "file=@$RESUME_PDF;type=application/pdf" 2>/dev/null || echo "")
RESUME_ID=$(echo "$R" | jq "print(d['data']['id'])")
[ -z "$RESUME_ID" ] && fail "Resume upload failed" "$R"
echo "  resume_id: $RESUME_ID"
pass "Resume uploaded and parsed"

# STEP 4: GET /api/resumes (list)
info "STEP 4: GET /api/resumes"
R=$(curl -s -b "$COOKIE_JAR" "$BASE/api/resumes" 2>/dev/null || echo "")
R_COUNT=$(echo "$R" | jq "print(len(d['data']))")
[ -z "$R_COUNT" ] || [ "$R_COUNT" = "0" ] && fail "Resume list failed" "$R"
pass "Resume list OK ($R_COUNT resumes)"

# STEP 5: Ingest JD (file upload)
info "STEP 5: Ingest JD via file upload"
R=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE/api/jds" \
  -F "file=@$JD_PDF;type=application/pdf" 2>/dev/null || echo "")
JD_ID=$(echo "$R" | jq "print(d['data']['id'])")
[ -z "$JD_ID" ] && fail "JD ingestion failed" "$R"
JD_TITLE=$(echo "$R" | jq "print(d['data']['title'])")
echo "  jd_id: $JD_ID  title: $JD_TITLE"
pass "JD ingested and cleaned"

# STEP 6: Create resume version (gap analysis)
info "STEP 6: Create resume version + gap analysis"
R=$(curl -s --max-time 90 -b "$COOKIE_JAR" -X POST "$BASE/api/resume-versions" \
  -H "Content-Type: application/json" \
  -d "{\"resume_id\":\"$RESUME_ID\",\"job_description_id\":\"$JD_ID\"}" 2>/dev/null || echo "")
VERSION_ID=$(echo "$R" | jq "print(d['data']['resume_version']['id'])")
SESSION_ID=$(echo "$R" | jq "print(d['data']['interview_session']['id'])")
GAP_COUNT=$(echo "$R" | jq "print(len(d['data']['interview_session']['identified_gaps']['gaps']))")
[ -z "$VERSION_ID" ] && fail "Resume version creation failed" "$R"
echo "  version_id: $VERSION_ID"
echo "  session_id: $SESSION_ID"
echo "  gaps found: $GAP_COUNT"
pass "Gap analysis: $GAP_COUNT gaps identified"

# STEP 7: Start interview
info "STEP 7: Start interview"
R=$(curl -s --max-time 60 -b "$COOKIE_JAR" -X POST \
  "$BASE/api/interview-sessions/$SESSION_ID/start" 2>/dev/null || echo "")
Q1=$(echo "$R" | jq "t=d['data']['conversation_transcript']; q=[m for m in t if m['role']=='assistant'][-1]['content']; print(q[:80])")
[ -z "$Q1" ] && fail "Interview start failed" "$R"
echo "  Q1: ${Q1}..."
pass "Interview started"

# STEP 8: Reply loop
info "STEP 8: Interview reply loop"
TURNS=0
while true; do
  REPLY="I have strong hands-on experience with this and have used it in multiple production projects."
  R=$(curl -s --max-time 60 -b "$COOKIE_JAR" -X POST \
    "$BASE/api/interview-sessions/$SESSION_ID/reply" \
    -H "Content-Type: application/json" \
    -d "{\"message\":\"$REPLY\"}" 2>/dev/null || echo "")
  STATUS=$(echo "$R" | jq "print(d['data']['status'])")
  TURNS=$((TURNS+1))
  if [ "$STATUS" = "completed" ]; then
    pass "Interview completed after $TURNS replies"
    break
  elif [ "$STATUS" = "in_progress" ]; then
    NEXT_Q=$(echo "$R" | jq "t=d['data']['conversation_transcript']; q=[m for m in t if m['role']=='assistant'][-1]['content']; print(q[:60])")
    echo "  Turn $TURNS -> next Q: ${NEXT_Q}..."
  else
    fail "Unexpected interview status ($STATUS)" "$R"
  fi
  if [ "$TURNS" -ge 25 ]; then
    fail "Interview exceeded 25 turns" ""
  fi
done

# STEP 9: Rewrite resume
info "STEP 9: Rewrite resume"
R=$(curl -s --max-time 120 -b "$COOKIE_JAR" -X POST \
  "$BASE/api/resume-versions/$VERSION_ID/rewrite" 2>/dev/null || echo "")
RW_STATUS=$(echo "$R" | jq "print(d['data']['status'])")
[ "$RW_STATUS" != "ready" ] && fail "Rewrite failed (status=$RW_STATUS)" "$R"
pass "Resume rewritten (status=ready)"

# STEP 10: Generate cover letter
info "STEP 10: Generate cover letter"
R=$(curl -s --max-time 120 -b "$COOKIE_JAR" -X POST "$BASE/api/cover-letters" \
  -H "Content-Type: application/json" \
  -d "{\"resume_version_id\":\"$VERSION_ID\",\"recruiter_name\":\"Hiring Manager\"}" 2>/dev/null || echo "")
CL_ID=$(echo "$R" | jq "print(d['data']['id'])")
[ -z "$CL_ID" ] && fail "Cover letter generation failed" "$R"
echo "  cover_letter_id: $CL_ID"
pass "Cover letter generated"

# STEP 11: ATS score
info "STEP 11: ATS score"
R=$(curl -s --max-time 90 -b "$COOKIE_JAR" -X POST "$BASE/api/ats-scores" \
  -H "Content-Type: application/json" \
  -d "{\"resume_version_id\":\"$VERSION_ID\"}" 2>/dev/null || echo "")
SCORE=$(echo "$R" | jq "print(d['data']['overall_score'])")
CAT=$(echo "$R" | jq "print(d['data']['category'])")
[ -z "$SCORE" ] && fail "ATS scoring failed" "$R"
echo "  overall_score: $SCORE  category: $CAT"
pass "ATS scored: $SCORE ($CAT)"

# STEP 12: History list
info "STEP 12: GET /api/history"
R=$(curl -s -b "$COOKIE_JAR" "$BASE/api/history" 2>/dev/null || echo "")
H_COUNT=$(echo "$R" | jq "print(len(d['data']))")
[ -z "$H_COUNT" ] && fail "History list failed" "$R"
pass "History list: $H_COUNT entries"

# STEP 13: History detail
info "STEP 13: GET /api/history/[version_id]"
R=$(curl -s -b "$COOKIE_JAR" "$BASE/api/history/$VERSION_ID" 2>/dev/null || echo "")
H_ID=$(echo "$R" | jq "print(d['data']['resume_version']['id'])")
[ -z "$H_ID" ] && fail "History detail failed" "$R"
pass "History detail OK"

# STEP 14: PDF signed URLs
info "STEP 14: PDF signed URLs"
R=$(curl -s -b "$COOKIE_JAR" "$BASE/api/resume-versions/$VERSION_ID/pdf-url" 2>/dev/null || echo "")
PDF_URL=$(echo "$R" | jq "print(d['url'])")
[ -z "$PDF_URL" ] && fail "Resume PDF URL failed" "$R"
pass "Resume PDF signed URL OK"
R=$(curl -s -b "$COOKIE_JAR" "$BASE/api/cover-letters/$CL_ID/pdf-url" 2>/dev/null || echo "")
CL_URL=$(echo "$R" | jq "print(d['url'])")
[ -z "$CL_URL" ] && fail "Cover letter PDF URL failed" "$R"
pass "Cover letter PDF signed URL OK"

# STEP 15: Logout
info "STEP 15: Logout + session invalidation"
R=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE/api/auth/logout" 2>/dev/null || echo "")
LOGOUT_OK=$(echo "$R" | jq "print('ok' if d.get('success') else 'no')")
[ "$LOGOUT_OK" != "ok" ] && fail "Logout failed" "$R"
pass "Logged out"
R=$(curl -s -b "$COOKIE_JAR" "$BASE/api/auth/me" 2>/dev/null || echo "")
ME_ERR=$(echo "$R" | jq "print(d.get('error',''))")
[ -z "$ME_ERR" ] && fail "Session still active after logout" "$R"
pass "Session invalidated (401)"

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  ALL 15 STEPS PASSED - E2E TEST COMPLETE  ${NC}"
echo -e "${GREEN}============================================${NC}"
