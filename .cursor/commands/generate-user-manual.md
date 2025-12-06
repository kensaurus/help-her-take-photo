# Generate Automated User Manual

## Overview
Systematically explore web application, capture visual documentation, analyze functionality, and generate comprehensive user manual for end-users with screenshots and step-by-step guides.

## Configuration
Before starting, configure in cursor command or separate config file:
- Target URL and login credentials
- Application name, version, company details
- Scraping depth and screenshot settings
- Wait times and capture preferences

## Steps
1. **Set up documentation structure**
   - Create folder hierarchy for manual sections
   - Set up screenshot organization
   - Initialize table of contents
   - Create glossary and index files
   - Prepare output format templates

2. **Authenticate and access application**
   - Navigate to login page and capture screenshot
   - Document login page elements and fields
   - Perform login with configured credentials
   - Capture post-login dashboard state
   - Verify successful authentication

3. **Discover and map application**
   - Identify main navigation structure
   - Catalog all page types (static, dynamic, forms, lists)
   - Map user flows and workflows
   - Create site map document
   - Track visited and pending pages

4. **Analyze each page systematically**
   - Capture full page screenshot
   - Identify and catalog all interactive elements
   - Document buttons, inputs, forms, tables, modals
   - Extract tooltips, placeholders, help text
   - Map element relationships and workflows

5. **Generate page documentation**
   - Create page overview and access instructions
   - Document all page sections with screenshots
   - Create interactive element tables
   - Write step-by-step workflow guides
   - Add tips, warnings, and best practices

6. **Capture comprehensive screenshots**
   - Full page views on first visit
   - Individual section screenshots
   - Interactive states (hover, focus, error, success)
   - Modal and dialog states
   - Form states (empty, filled, validation, success)

7. **Document forms and workflows**
   - Map all form fields with validation rules
   - Create field description tables
   - Document submission process
   - Capture all form states visually
   - Write step-by-step completion guides

8. **Generate master documentation**
   - Compile table of contents
   - Generate glossary from discovered terms
   - Create keyboard shortcuts reference
   - Write troubleshooting guide
   - Compile related page links

9. **Quality assurance check**
   - Verify documentation completeness
   - Check screenshot coverage
   - Validate workflow documentation
   - Review element coverage
   - Identify missing content

10. **Export in multiple formats**
    - Generate markdown files
    - Create HTML website version
    - Generate PDF manual
    - Create quick reference card
    - Package all assets

## Documentation Checklist
- [ ] Configuration values set
- [ ] Documentation structure created
- [ ] Login process documented
- [ ] All pages discovered and mapped
- [ ] Site map generated
- [ ] Each page analyzed for elements
- [ ] Full page screenshots captured
- [ ] Section screenshots taken
- [ ] Interactive state screenshots captured
- [ ] Forms documented with field tables
- [ ] Workflows written step-by-step
- [ ] Navigation documented
- [ ] Settings pages covered
- [ ] Table of contents generated
- [ ] Glossary compiled
- [ ] Keyboard shortcuts listed
- [ ] Troubleshooting guide created
- [ ] Quality check completed
- [ ] Multiple formats exported

## Element Detection Priorities
**Interactive elements to find:**
- Buttons and action triggers
- Links and navigation
- Form inputs and controls
- Tables and data displays
- Modals and dialogs
- Menus and dropdowns
- Tabs and accordions
- Tooltips and help text

**Documentation for each element:**
- Visual appearance
- Purpose and function
- How to interact
- Expected results
- Related elements
- Validation rules (for inputs)

## Screenshot Capture Rules
**Required screenshots:**
- Full page on first visit
- Each major section separately
- All interactive states
- Form states (empty, filled, error, success)
- Modal/dialog states
- Hover and focus states

**Naming convention:**
- `[timestamp]_[pagename]_[state].png`
- Organize by section in folders
- Include descriptive labels

## Page Documentation Template
**Each page must include:**
- Overview and purpose
- How to access
- Required permissions
- Full page screenshot
- Navigation elements guide
- Section-by-section breakdown
- Interactive elements table
- Field descriptions table
- Step-by-step workflows
- Tips and best practices
- Keyboard shortcuts
- Related pages
- Troubleshooting

## Workflow Documentation Format
**For each workflow:**
- Overview and prerequisites
- Required permissions
- Step-by-step instructions with screenshots
- Expected outcomes
- Common issues and solutions
- Tips for efficiency

## Exploration Strategy
- Use breadth-first navigation
- Track visited pages to avoid loops
- Respect max depth configuration
- Wait for pages to fully load
- Discover links systematically
- Follow logical user paths

## Output Requirements
**Generate these files:**
- index.md (table of contents)
- Individual page guides
- Workflow documents
- Settings documentation
- Troubleshooting guide
- Glossary of terms
- Keyboard shortcuts reference
- Site map
- Screenshot library organized by section