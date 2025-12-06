# QA Testing Command - Playwright MCP

## Your Mission
Test the localhost application at **[LOCALHOST_URL]** using Playwright MCP. Find ALL bugs, fix them autonomously, and continue testing until told to stop. Never ask permission to fix bugs - just fix them.

**IMPORTANT**: There are NO time constraints. Continue testing, fixing, and documenting until you've completed the entire procedure or are explicitly told to stop. This is a continuous process - do not stop prematurely.

## Execution Protocol

### Step 1: Discover Application (Do This First)
```
1. Navigate to localhost URL via Playwright
2. Extract visible HTML and text
3. Capture full-page screenshot
4. Map all routes, pages, and navigation
5. Identify EVERY interactive element:
   - All buttons (including icon buttons)
   - All form inputs/textareas
   - All links
   - All dropdowns/selects
   - All checkboxes/radios
   - All modals/dialogs
   - All dynamic content areas
6. Check console logs (baseline)
7. Understand the application's purpose and flows
```

### Step 2: Test Everything Concurrently

**Test ALL of these via Playwright (not manually):**

- **Every Button**: Click it, check console, check network, verify action, test hover/disabled states, test keyboard (Enter/Space)
- **Every Input**: Fill valid data, fill invalid data, test empty, test max length, test XSS (`<script>alert('xss')</script>`), verify validation
- **Every Form**: Submit with valid/invalid data, verify validation, check success/error states, test required fields
- **Every Link**: Click it, verify navigation works, check for 404s
- **Every Dropdown**: Select each option, verify state changes, test keyboard nav
- **Every Modal**: Open/close, test ESC key, test overlay click, verify focus trap
- **Authentication** (if exists): Login valid/invalid, logout, protected routes, session handling
- **CRUD** (if exists): Create, Read, Update, Delete - verify all operations work
- **Dynamic Content**: Pagination, infinite scroll, lazy loading, search, filter, sort
- **Cross-Browser**: Run critical tests in Chromium, Firefox, WebKit
- **Responsive**: Test at 375x667, 768x1024, 1920x1080, 2560x1440 viewports
- **Performance**: Monitor ALL network requests (check for 4xx/5xx errors), measure LCP/FCP/TTI via JavaScript
- **Edge Cases**: Empty states, max data, special characters (Unicode, emojis), error pages (404, 500)

**Monitor Constantly:**
- Console logs (errors, warnings)
- Network requests (failed requests, slow responses, error status codes)
- JavaScript exceptions
- Validation errors

### Step 3: Autonomous Bug Fixing (Critical)

**When you find a bug:**

1. **Document it immediately** in `/docs/qa-test-report.md`:
   ```
   Bug #X - [Title]
   - Severity: Critical/High/Medium/Low
   - Location: [page/component/file]
   - Console Error: [error]
   - Network Error: [failed request]
   - Steps: 1. X, 2. Y, 3. Z
   - Expected: [X]
   - Actual: [Y]
   - Status: Fixing...
   ```

2. **Analyze root cause** from console/network logs

3. **Identify the file(s)** and code causing the issue

4. **Fix the bug immediately**:
   - Propose the code change
   - Apply the fix to the actual file
   - **DO NOT run `npm run build`** - HMR is enabled
   
5. **Wait 2-3 seconds** for HMR to reload

6. **Re-test via Playwright** (exact same test that failed)

7. **Update the bug report**:
   - Add "Fix: [what you changed]"
   - Update Status: "Fixed ✓" or "Still Broken - trying alternative fix"

8. **If still broken**: Try alternative fix, re-test again

9. **If fixed**: Test related features (regression check)

10. **Move to next bug** - repeat steps 1-9

**DO NOT:**
- Ask for permission to fix bugs
- Stop and wait for approval
- Skip bugs
- Only document without fixing

**DO:**
- Fix every bug you find
- Re-test after every fix
- Update the report after every fix
- Continue testing until explicitly told to stop
- Fix bugs in order of severity (Critical → High → Medium → Low)

### Step 4: Continuous Loop (No Time Limits)

**Keep running until explicitly told to stop:**

```
while (not told to stop) {
  Test next feature/component via Playwright
  if (bug found) {
    Document bug in /docs/qa-test-report.md
    Fix bug
    Re-test via Playwright
    Update report
  }
  if (test passes) {
    Move to next feature
  }
}
```

**Never stop on your own.** Complete all testing, all bug fixes, all cross-browser checks, all responsive testing, and all documentation. Only stop when the user explicitly tells you to stop.

## Report Format

**File**: `/docs/qa-test-report.md` (append only)

```markdown
# QA Test Report - [Date/Time]

## Summary
- URL: localhost:[port]
- Tests Run: [#]
- Bugs Found: [#]  
- Bugs Fixed: [#]
- Bugs Remaining: [#]
- Status: In Progress / Complete

---

## Bug #1 - [Title]
**Severity**: Critical  
**Location**: HomePage / SubmitButton  
**Browser**: Chromium @ 1920x1080

**Issue**: Button click causes console error and doesn't submit form

**Steps**:
1. Navigate to home page
2. Fill form with valid data
3. Click submit button

**Expected**: Form submits, success message shows  
**Actual**: Console error, form doesn't submit

**Console Error**:
```
TypeError: Cannot read property 'value' of null at handleSubmit
```

**Root Cause**: Missing null check in handleSubmit function in SubmitButton.tsx

**Fix Applied**: Added null check before accessing form.value
```javascript
if (!form || !form.value) return;
```

**Re-test Result**: ✓ Fixed - form now submits correctly  
**Status**: Fixed ✓

---

## Bug #2 - [Title]
[Same format...]

---

## Performance Metrics
- LCP: [X]ms
- FCP: [X]ms  
- TTI: [X]ms
- Failed Requests: [#] (list them)

## Recommendations
1. [Issue and suggested fix]
2. [Issue and suggested fix]
```

## Key Principles

1. **Autonomy**: Fix all bugs yourself - never ask permission
2. **No Time Constraints**: Continue until complete or explicitly told to stop - never stop prematurely
3. **HMR**: Never run `npm run build` - fixes apply instantly
4. **Playwright Testing**: Test everything through Playwright, not manually
5. **Completeness**: Test ALL features unless explicitly excluded
6. **Continuous**: Keep testing and fixing in an endless loop until told to stop
7. **Documentation**: Update `/docs/qa-test-report.md` after every bug fix
8. **Regression**: Re-test related features after fixes
9. **Console/Network**: Monitor constantly for errors

## Playwright Tools Quick Reference

- `playwright_navigate(url)` - Navigate to page
- `playwright_click(selector)` - Click element
- `playwright_fill(selector, text)` - Fill input
- `playwright_select(selector, value)` - Select dropdown
- `playwright_screenshot()` - Capture screenshot
- `playwright_get_visible_html()` - Get HTML structure
- `playwright_console_logs()` - Get console output
- `playwright_evaluate(js_code)` - Run JavaScript
- `playwright_expect_response(url)` - Monitor network
- `playwright_close()` - Close browser

## Example Workflow

```
1. Navigate to http://localhost:3000
2. Discover: Map homepage, find 5 buttons, 3 forms, 8 links
3. Test Button #1: Click "Login" button via Playwright
4. BUG FOUND: Console error "undefined is not a function"
5. Document bug in report (Status: Fixing...)
6. Analyze: Missing import in LoginButton.tsx
7. Fix: Add missing import statement
8. Wait 2s for HMR reload
9. Re-test: Click "Login" button again via Playwright
10. Success! Update report (Status: Fixed ✓)
11. Test Button #2: Click "Register" button via Playwright
12. Works fine - move to Button #3
13. Continue testing...
```

## Success Criteria

You're done when:
- ✓ Every interactive element has been tested via Playwright
- ✓ All bugs found have been fixed and verified
- ✓ Console shows no errors
- ✓ Network shows no failed requests
- ✓ Cross-browser testing complete
- ✓ Responsive testing complete
- ✓ Report is comprehensive and up-to-date

**Remember: You are autonomous. Find, fix, test, document, repeat. Don't stop until told to stop. There are no time constraints - complete the entire testing procedure.**