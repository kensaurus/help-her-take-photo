# Debug Webpage with Playwright MCP

## Overview
Systematically debug webpage using Playwright MCP tools to test visual rendering, content structure, interactions, performance, and cross-browser compatibility.

## Steps
1. **Setup and test navigation**
   - Navigate to target URL in multiple browsers (Chromium, Firefox, WebKit)
   - Test different viewport sizes and device emulations
   - Toggle headless/headed modes for debugging
   - Verify back/forward navigation works correctly
   - Test with custom user agents for compatibility

2. **Perform visual inspection**
   - Capture full-page screenshots
   - Take element-specific screenshots for problem areas
   - Save page state as PDF for documentation
   - Check for design inconsistencies or rendering issues
   - Verify responsive design across viewports

3. **Analyze content structure**
   - Extract visible text content for verification
   - Get visible HTML to check markup structure
   - Validate content integrity and completeness
   - Check for missing or malformed content
   - Verify semantic HTML structure

4. **Monitor console and errors**
   - Capture all console logs (errors, warnings, info, debug)
   - Filter logs by type to find specific issues
   - Search console output for error patterns
   - Document JavaScript exceptions
   - Track console errors during interactions

5. **Test interactive elements**
   - Click links and buttons, verify navigation
   - Test form field inputs and validation
   - Verify dropdown selections work correctly
   - Check CSS hover states and transitions
   - Test keyboard navigation and shortcuts
   - Verify file upload functionality
   - Test drag-and-drop interactions

6. **Test embedded content**
   - Interact with iframe elements
   - Fill forms within iframes
   - Verify iframe content loads correctly
   - Test cross-origin iframe behavior
   - Check embedded media playback

7. **Monitor network and performance**
   - Track XHR and API requests
   - Validate response status codes
   - Check response payloads for errors
   - Monitor request timing and performance
   - Verify API integration correctness

8. **Execute advanced debugging**
   - Run custom JavaScript for DOM inspection
   - Analyze performance metrics
   - Test dynamic content updates
   - Check state changes and transitions
   - Verify client-side logic

9. **Record problematic workflows**
   - Start codegen session to record interactions
   - Reproduce bug or error scenario
   - End session to generate test script
   - Save workflow for future regression testing
   - Document steps to reproduce issues

10. **Clean up and report**
    - Close browser and cleanup resources
    - Compile list of issues found
    - Prioritize bugs by severity
    - Document reproduction steps
    - Generate debugging report

## Debugging Checklist
- [ ] Cross-browser testing completed (Chromium, Firefox, WebKit)
- [ ] Multiple viewport sizes tested
- [ ] Navigation flow verified
- [ ] Full-page screenshots captured
- [ ] Console logs analyzed for errors
- [ ] All links and buttons tested
- [ ] Form validation verified
- [ ] Hover states checked
- [ ] Keyboard navigation tested
- [ ] File upload tested (if applicable)
- [ ] Drag-and-drop tested (if applicable)
- [ ] Iframe content tested (if applicable)
- [ ] Network requests monitored
- [ ] API responses validated
- [ ] Performance metrics checked
- [ ] Problematic workflows recorded
- [ ] Test scripts generated
- [ ] Issues documented and prioritized
- [ ] Resources cleaned up

## Testing Priorities by Category

**Visual Issues:**
- Layout breaks or misalignment
- Responsive design problems
- CSS rendering issues
- Image loading failures
- Font or icon problems

**Content Issues:**
- Missing or incorrect text
- Broken links
- Malformed HTML
- Accessibility problems
- Content overflow or truncation

**Interaction Issues:**
- Non-functional buttons or links
- Form validation errors
- Broken navigation
- Unresponsive hover states
- Keyboard navigation failures

**Performance Issues:**
- Slow page loads
- Failed API requests
- Long response times
- Memory leaks
- Unoptimized assets

## Playwright MCP Tools Reference

**Navigation:**
- `playwright_navigate` - Navigate to URL
- `playwright_go_back` - Go back in history
- `playwright_go_forward` - Go forward in history
- `playwright_custom_user_agent` - Set custom user agent

**Visual Capture:**
- `playwright_screenshot` - Capture screenshots
- `playwright_save_as_pdf` - Save page as PDF

**Content Extraction:**
- `playwright_get_visible_text` - Extract visible text
- `playwright_get_visible_html` - Get visible HTML

**Monitoring:**
- `playwright_console_logs` - Capture console output

**Interaction:**
- `playwright_click` - Click elements
- `playwright_click_and_switch_tab` - Click and switch tabs
- `playwright_fill` - Fill form fields
- `playwright_select` - Select dropdown options
- `playwright_hover` - Hover over elements
- `playwright_press_key` - Press keyboard keys
- `playwright_upload_file` - Upload files
- `playwright_drag` - Drag and drop

**Iframe Testing:**
- `playwright_iframe_click` - Click in iframe
- `playwright_iframe_fill` - Fill iframe forms

**Advanced:**
- `playwright_evaluate` - Execute JavaScript
- `playwright_expect_response` - Wait for responses
- `playwright_assert_response` - Validate responses

**Recording:**
- `start_codegen_session` - Start recording
- `end_codegen_session` - End and generate script

**Cleanup:**
- `playwright_close` - Close browser

## Issue Documentation Format

**For each issue found:**
- Issue type (visual, content, interaction, performance)
- Severity (critical, high, medium, low)
- Browser(s) affected
- Viewport size (if relevant)
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshot/recording
- Console errors (if any)
- Network errors (if any)