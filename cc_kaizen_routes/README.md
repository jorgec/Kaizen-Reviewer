# Kaizen Route Generator

A Cookiecutter template for quickly scaffolding new SvelteKit routes in the Kaizen application with modern, premium SaaS styling.

## Features

- **Modern SaaS Design**: Muted purple theme with gradient accents
- **Responsive Layout**: Mobile-first design that works on all devices
- **Smart Defaults**: Pre-configured with common patterns from existing routes
- **Flexible Options**: Choose between analytics, dashboard, form, or list layouts
- **Optional Components**: Include filters, tables, or modals as needed
- **Type-Safe**: TypeScript-ready with proper type annotations
- **User Authentication**: Built-in user state management and auth checks
- **Loading States**: Professional loading, error, and empty states

## Prerequisites

```bash
pip install -r requirements.txt
```

## Quick Start

### 1. Generate a New Route

From your project root (`kaizen/`):

```bash
cookiecutter cc_kaizen_routes
```

### 2. Answer the Prompts

- **route_name**: The folder name (e.g., `my_feature`)
- **route_display_name**: Human-readable title (e.g., `My Feature`)
- **route_description**: Brief description shown on the page
- **route_type**: Choose from:
  - `analytics` - For metrics and data visualization pages
  - `dashboard` - For overview/summary pages
  - `form` - For data entry pages
  - `list` - For browsing collections
- **include_filters**: Add Subject/Topic/Subtopic cascading filters
- **include_table**: Add a sortable data table
- **include_modal**: Add a modal dialog for details
- **primary_color**: Main brand color (default: `#a855f7` purple)
- **secondary_color**: Secondary brand color (default: `#8b5cf6`)
- **accent_color**: Accent color (default: `#14b8a6` teal)

### 3. Move the Generated Route

The template generates a folder named after your `route_name`. Move it to the appropriate location:

```bash
# For a top-level route
mv my_feature src/routes/

# For a nested route (e.g., under analytics)
mv my_feature src/routes/analytics/
```

### 4. Implement Your Data Logic

Open the generated `+page.svelte` file and update the `fetchData()` function:

```typescript
async function fetchData() {
    // Replace with your actual RPC call
    const { data: result, error } = await supabase.rpc('your_rpc_function_here', {
        p_user_id: user.user_id,
        p_discipline_id: currentDiscipline.discipline_id
    });

    if (error) throw error;
    data = result || [];
}
```

### 5. Customize the Display

Update the table columns, card fields, or other UI elements to match your data structure.

## Template Structure

```
{{cookiecutter.route_name}}/
└── +page.svelte          # Main page component
```

The generated page includes:

- **Script Section**: TypeScript with:
  - User authentication and state management
  - Loading/error handling
  - Optional filters (cascading Subject/Topic/Subtopic)
  - Optional table sorting
  - Optional modal functionality
  - Data fetching with Supabase RPC

- **Template Section**: Svelte markup with:
  - Gradient header with title and description
  - Loading spinner state
  - Error state with retry button
  - Optional filter controls
  - Optional sortable table OR card grid
  - Optional modal dialog

- **Style Section**: Scoped CSS with:
  - Muted purple theme colors
  - Modern gradients and shadows
  - Smooth transitions and animations
  - Responsive breakpoints
  - Premium SaaS aesthetics

## Customization

### Change Colors

Edit the generated CSS variables or pass different colors during generation:

```css
.modern-button {
    background: linear-gradient(135deg, {{ cookiecutter.primary_color }}, {{ cookiecutter.secondary_color }});
}
```

### Add More Filters

Extend the filter section with additional dropdowns:

```svelte
<div class="filter-group">
    <label class="filter-label">Custom Filter</label>
    <select bind:value={customFilter} class="modern-select">
        <!-- options -->
    </select>
</div>
```

### Modify Table Columns

Update the table structure in both `<thead>` and `<tbody>`:

```svelte
<th>
    <button class="sort-btn" on:click={() => sortBy('new_column')}>
        New Column
        {#if sortColumn === 'new_column'}
            <span class="sort-indicator {sortDirection}">▼</span>
        {/if}
    </button>
</th>
```

### Add Navigation Links

Include navigation in the header or use the global layout navbar.

## Best Practices

1. **Authentication**: The template includes user auth checks. Keep the `onMount` guard:
   ```typescript
   if (!user?.user_id) {
       goto('/login');
       return;
   }
   ```

2. **Error Handling**: Always wrap Supabase calls in try/catch and set `errorMsg`.

3. **Loading States**: Set `loading = true` before async operations and `false` in `finally`.

4. **Reactive Data**: Use `$:` statements for reactive filtering and sorting.

5. **Accessibility**: The template includes ARIA labels and semantic HTML. Maintain these.

6. **Responsive Design**: Test on mobile, tablet, and desktop breakpoints.

## Examples

### Analytics Page

```bash
cookiecutter cc_kaizen_routes
# route_name: topic_performance
# route_display_name: Topic Performance
# route_type: analytics
# include_filters: yes
# include_table: yes
# include_modal: no
```

### Dashboard Card Grid

```bash
cookiecutter cc_kaizen_routes
# route_name: overview
# route_display_name: Overview Dashboard
# route_type: dashboard
# include_filters: no
# include_table: no
# include_modal: yes
```

### Form Page

```bash
cookiecutter cc_kaizen_routes
# route_name: create_assessment
# route_display_name: Create Assessment
# route_type: form
# include_filters: yes
# include_table: no
# include_modal: no
```

## Troubleshooting

### Route not found (404)

Ensure the folder is in `src/routes/` and named correctly.

### Styles not applying

Check that `src/lib/styles/purpley.css` is imported in your global `app.css`.

### Data not loading

1. Verify user is authenticated
2. Check browser console for errors
3. Ensure RPC function name is correct
4. Verify database permissions

## Contributing

To improve this template:

1. Edit files in `cc_kaizen_routes/`
2. Test generation with `cookiecutter cc_kaizen_routes/`
3. Document changes in this README

## Support

For issues or questions:
- Check existing routes in `src/routes/` for examples
- Review SvelteKit docs: https://kit.svelte.dev/
- Check Cookiecutter docs: https://cookiecutter.readthedocs.io/

## License

Same as the Kaizen project.
