# Review Webpage Implementation

## Overview
Comprehensive analysis of webpage architecture by examining all README files throughout the project to understand implementation patterns, conventions, and system design.

## Steps
1. **Locate and read all README files**
   - Review main @README.md for project overview
   - Read section-specific READMEs (@_pages-README.md, @_stores-README.md, etc.)
   - Find additional feature-specific README files (XXXREADME.md pattern)
   - Catalog all documentation locations
   - Note any missing or outdated documentation

2. **Analyze overall architecture**
   - Map high-level application structure
   - Identify main modules and their purposes
   - Understand system organization patterns
   - Document architectural decisions and rationale
   - Note technology stack and framework choices

3. **Review component patterns**
   - Examine component interaction methods (props, context, state)
   - Identify compositional design patterns
   - Map component hierarchy and relationships
   - Document reusable component library
   - Note component naming and organization conventions

4. **Trace data flow patterns**
   - Map data flow from API to UI
   - Document API call patterns and services
   - Review state management implementation
   - Analyze form validation approaches
   - Identify data transformation points

5. **Evaluate state management**
   - Identify state management solution(s) used
   - Review global vs local state patterns
   - Analyze state update patterns
   - Document context usage and structure
   - Note performance optimization strategies

6. **Examine service layer**
   - Review API communication patterns
   - Document authentication/authorization flow
   - Analyze error handling approaches
   - Map business logic organization
   - Note service separation and boundaries

7. **Analyze type definitions**
   - Review TypeScript interfaces and types
   - Document type organization structure
   - Identify shared types and utilities
   - Note type safety patterns
   - Check for type inconsistencies

8. **Document coding conventions**
   - Identify naming conventions used
   - Review file organization patterns
   - Note code style and formatting standards
   - Document best practices followed
   - Identify areas of inconsistency

## Review Analysis Checklist
- [ ] All README files located and read
- [ ] Architecture diagram created
- [ ] Component interaction patterns documented
- [ ] Data flow mapped end-to-end
- [ ] State management approach identified
- [ ] Service layer structure documented
- [ ] Type definitions catalogued
- [ ] Coding conventions summarized
- [ ] Technology stack listed
- [ ] Best practices identified
- [ ] Inconsistencies noted
- [ ] Missing documentation flagged
- [ ] Improvement opportunities listed

## Key Focus Areas

**Overall Architecture:**
- Module organization and boundaries
- Separation of concerns
- Scalability considerations
- Code splitting strategies

**Component Interaction:**
- Props drilling vs context usage
- Component composition patterns
- Event handling approaches
- Ref usage and forwarding

**Data Flow Patterns:**
- API request/response handling
- Client-side caching strategies
- Optimistic updates
- Real-time data synchronization

**State Management:**
- Global state structure
- Local state conventions
- Side effect handling
- State persistence approaches

**Service Layer:**
- API client configuration
- Request/response interceptors
- Error handling standards
- Retry and timeout policies

**Type Definitions:**
- Interface vs type usage
- Generic type patterns
- Utility type usage
- Type inference strategies

**Coding Conventions:**
- File naming patterns
- Import organization
- Comment standards
- Testing conventions

## Analysis Output
Create comprehensive report including:
- Architecture overview and diagram
- Component relationship map
- Data flow visualization
- State management summary
- Service layer documentation
- Type system analysis
- Coding standards guide
- Recommendations for improvements
- Identified technical debt
- Best practices to adopt