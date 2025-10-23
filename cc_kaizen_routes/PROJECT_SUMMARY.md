# Kaizen Route Cookiecutter Template - Project Summary

## Overview

This is a Python Cookiecutter template for rapidly scaffolding new SvelteKit routes in the Kaizen application. It generates production-ready page components with modern SaaS styling, matching the existing muted purple theme and design patterns.

## Project Structure

```
cc_kaizen_routes/
├── cookiecutter.json              # Template configuration with smart defaults
├── requirements.txt               # Python dependencies for standalone usage
├── README.md                       # Comprehensive documentation
├── USAGE.md                        # Quick start guide
├── PROJECT_SUMMARY.md             # This file
├── .gitignore                     # Git ignore patterns
├── test_template.sh               # Automated test script
├── {{cookiecutter.route_name}}/   # Template folder (Jinja2 variables)
│   └── +page.svelte               # Main page component template
├── hooks/
│   └── post_gen_project.py        # Post-generation success message
└── examples/                      # Pre-configured example configs
    ├── analytics_route.yaml       # Analytics page with filters & table
    ├── dashboard_route.yaml       # Dashboard with card grid
    └── simple_list.yaml           # Simple list with table
```

## Key Features

### 1. Template Configuration (cookiecutter.json)

- **route_name**: Folder name (snake_case)
- **route_display_name**: Human-readable title
- **route_description**: Page subtitle
- **route_type**: Choose from analytics, dashboard, form, or list
- **include_filters**: Cascading Subject/Topic/Subtopic dropdowns
- **include_table**: Sortable data table with actions
- **include_modal**: Modal dialog system
- **Color customization**: Primary, secondary, and accent colors
- **Smart defaults**: All based on existing Kaizen design patterns

### 2. Generated Page Component (+page.svelte)

The template generates a complete SvelteKit page with:

#### **Script Section (TypeScript)**
- User authentication and state management via `userStore`
- Reactive user properties (`currentDiscipline`, `currentOrg`)
- Loading, error, and data state management
- Optional cascading filters with reactive options
- Optional table sorting functionality
- Optional modal state management
- Supabase RPC data fetching with error handling
- Reactive data fetching on discipline changes
- Route guards (redirect to login if unauthenticated)

#### **Template Section (Svelte)**
- Gradient header with title and description
- Professional loading state with spinner
- User-friendly error state with retry button
- Optional filter controls (3-level cascading)
- Optional sortable table OR responsive card grid
- Optional modal dialog with header/body/footer
- Empty state handling
- Accessibility features (ARIA labels, semantic HTML)

#### **Style Section (Scoped CSS)**
- Muted purple theme (`#a855f7`, `#8b5cf6`)
- Modern gradients and subtle shadows
- Smooth transitions (cubic-bezier easing)
- Responsive breakpoints (768px, 1200px)
- Premium SaaS aesthetics:
  - Backdrop blur effects
  - Layered shadows
  - 12-16px border radius
  - Color backgrounds with gradients
- Component-specific styles for:
  - Containers and wrappers
  - Headers with gradient text
  - Filters and form controls
  - Tables with hover effects
  - Card grids with lift animations
  - Modals with overlay and slide-up
  - Buttons with gradient backgrounds
  - Loading and error states

### 3. Theme Consistency

All generated routes match the existing Kaizen design system:

- **Colors**: Muted purple primary (#a855f7), secondary (#8b5cf6), accent teal (#14b8a6)
- **Typography**: Inter font, consistent sizing scale (0.75rem - 2.2rem)
- **Spacing**: rem-based units (0.5, 0.75, 1, 1.5, 2rem)
- **Animations**: 0.2s cubic-bezier transitions
- **Shadows**: Layered with rgba(0,0,0,0.06-0.3)
- **Gradients**: 135deg linear gradients for headers and buttons

### 4. Conditional Features

Based on user choices during generation:

| Feature | When Included | Components Added |
|---------|---------------|------------------|
| Filters | `include_filters: yes` | Cascading dropdowns, reactive filter state, filtered data |
| Table | `include_table: yes` | Sortable columns, hover effects, action buttons |
| Card Grid | `include_table: no` | Responsive grid layout, metric cards, lift animations |
| Modal | `include_modal: yes` | Overlay, card, header/body/footer, open/close functions |

### 5. Route Types

Four preset configurations:

1. **Analytics**: Data-heavy with metrics and visualizations
   - Best for: Reports, dashboards, performance tracking
   - Typically includes: Filters, tables, modals

2. **Dashboard**: Overview pages with cards
   - Best for: Summaries, key metrics, at-a-glance info
   - Typically includes: Card grids, modals

3. **Form**: Data entry and submission
   - Best for: Create/edit pages, settings, configuration
   - Typically includes: Form controls, validation

4. **List**: Browse and search collections
   - Best for: Browsing records, search results
   - Typically includes: Tables, filters

## Installation & Usage

### Quick Start

```bash
# Install dependencies
cd cc_kaizen_routes
pip install -r requirements.txt

# Generate a route (interactive)
cd ..
cookiecutter cc_kaizen_routes

# Move to project
mv my_feature src/routes/
```

### Non-Interactive (CI/CD)

```bash
cookiecutter cc_kaizen_routes --no-input \
  route_name=user_stats \
  route_display_name="User Statistics" \
  route_type=analytics \
  include_filters=yes \
  include_table=yes
```

### Using Example Configs

```bash
cookiecutter cc_kaizen_routes --no-input \
  --config-file cc_kaizen_routes/examples/analytics_route.yaml
```

## Dependencies

All dependencies are standalone - no global Kaizen dependencies required:

- **cookiecutter** (>=2.5.0): Template engine
- **Jinja2** (>=3.1.2): Templating (bundled with cookiecutter)
- **jinja2-time** (>=0.2.0): Timestamp support
- **arrow** (>=1.3.0): Datetime handling
- **click** (>=8.1.7): CLI framework
- **binaryornot** (>=0.4.4): Binary file detection
- **PyYAML** (>=6.0.1): YAML config support
- **python-slugify** (>=8.0.1): URL-safe slugs
- **rich** (>=13.7.0): Beautiful terminal output

## Testing

Run the automated test:

```bash
cd cc_kaizen_routes
./test_template.sh
```

This validates:
- Cookiecutter installation
- Template generation with example config
- File creation
- Template variable resolution
- Auto-cleanup

## Integration Points

### Kaizen Application

Generated routes integrate seamlessly with:

1. **User Store** (`$lib/stores/userStore`)
   - Subscribes to user state
   - Reactive discipline/org selection
   - Authentication checks

2. **Supabase Client** (`$lib/supabaseClient`)
   - RPC function calls
   - Error handling patterns

3. **Global Styles**
   - Inherits from `app.css`
   - Compatible with `purpley.css` theme
   - Uses existing CSS custom properties

4. **Layout System** (`+layout.svelte`)
   - Works with fixed navbar
   - Proper padding and spacing
   - Mobile menu compatibility

### Data Fetching Pattern

All routes use the same pattern:

```typescript
async function fetchData() {
  const { data: result, error } = await supabase.rpc('your_function', {
    p_user_id: user.user_id,
    p_discipline_id: currentDiscipline.discipline_id
  });
  if (error) throw error;
  data = result || [];
}

// Reactive fetch
$: if (browser && user?.user_id && currentDiscipline?.discipline_id) {
  fetchData();
}
```

## Customization After Generation

### Common Modifications

1. **Update RPC Function**
   ```typescript
   await supabase.rpc('your_actual_function', { /* params */ });
   ```

2. **Add Table Columns**
   - Update `<thead>` with new headers
   - Add sort button if sortable
   - Update `<tbody>` with new data cells

3. **Modify Filters**
   - Add new filter state variables
   - Create reactive options arrays
   - Add filter UI controls

4. **Style Adjustments**
   - Change colors via CSS variables
   - Adjust spacing with rem units
   - Modify responsive breakpoints

5. **Add Components**
   - Import Svelte components
   - Create `/components` subfolder
   - Follow existing component patterns

## Best Practices

### Generated Code Includes

✅ User authentication guards
✅ Loading and error states
✅ Responsive design
✅ Accessibility (ARIA, semantic HTML)
✅ TypeScript type safety
✅ Reactive state management
✅ Consistent styling
✅ Professional animations
✅ Empty state handling
✅ Proper error messages

### Developer Should Add

- Actual RPC function calls
- Specific data structure handling
- Business logic
- Validation rules
- Additional features specific to the route

## Example Output

### Analytics Route with All Features

Generates a page with:
- Gradient purple header
- Subject/Topic/Subtopic cascading filters
- Sortable table with 3+ columns
- Action buttons with hover effects
- Modal for detailed views
- Loading spinner during fetch
- Error state with retry
- Empty state message
- Fully responsive layout

**File size**: ~500 lines (including comprehensive CSS)
**Ready to use**: After replacing RPC function (~5 min)

## Maintenance

### Adding New Features

1. Edit `{{cookiecutter.route_name}}/+page.svelte`
2. Add new Jinja2 conditionals if optional
3. Update `cookiecutter.json` with new options
4. Document in README.md and USAGE.md
5. Test with `test_template.sh`

### Version Control

Recommended git workflow:
```bash
# Track template changes
git add cc_kaizen_routes/

# Do NOT track generated routes in template repo
# (already in .gitignore)
```

## Support & Documentation

- **README.md**: Full documentation with examples
- **USAGE.md**: Quick start and common tasks
- **Examples**: Pre-configured YAML files
- **Post-gen hook**: Displays next steps after generation
- **Test script**: Validates template functionality

## License

Same as Kaizen project.

## Created By

Generated based on analysis of existing Kaizen routes:
- `/analytics/mock_exam_metrics`
- `/analytics/subtopic_summary`
- `/analytics/aptitude`
- `/dashboard`
- Global layout and styling patterns

Designed to maintain consistency across the application while enabling rapid feature development.
