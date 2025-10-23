# Quick Usage Guide

## Installation

1. Install cookiecutter and dependencies:

```bash
cd cc_kaizen_routes
pip install -r requirements.txt
```

## Generate a New Route

From your Kaizen project root directory:

```bash
cookiecutter cc_kaizen_routes
```

## Example Session

```
route_name [my_feature]: user_progress
route_display_name [My Feature]: User Progress Analytics
route_description [A modern SaaS-style feature page]: Track user learning progress over time
Select route_type:
1 - analytics
2 - dashboard
3 - form
4 - list
Choose from 1, 2, 3, 4 [1]: 1
Select include_filters:
1 - yes
2 - no
Choose from 1, 2 [1]: 1
Select include_table:
1 - yes
2 - no
Choose from 1, 2 [1]: 1
Select include_modal:
1 - yes
2 - no
Choose from 1, 2 [1]: 2
primary_color [#a855f7]:
secondary_color [#8b5cf6]:
accent_color [#14b8a6]:
author_name [Kaizen Team]:
```

This generates:

```
user_progress/
└── +page.svelte
```

## Move to Project

```bash
# Move to routes
mv user_progress src/routes/analytics/

# Or for a top-level route
mv user_progress src/routes/
```

## Next Steps

1. Open `src/routes/analytics/user_progress/+page.svelte`
2. Find the `fetchData()` function
3. Replace the placeholder RPC call with your actual function:

```typescript
const { data: result, error } = await supabase.rpc('get_user_progress', {
    p_user_id: user.user_id,
    p_discipline_id: currentDiscipline.discipline_id
});
```

4. Update the table structure to match your data
5. Test at `http://localhost:5173/analytics/user_progress`

## Template Options Explained

### route_type

- **analytics**: Data-heavy pages with metrics, charts, and tables
- **dashboard**: Overview pages with cards and summaries
- **form**: Data entry and submission pages
- **list**: Browse and search through collections

### include_filters

Adds cascading Subject > Topic > Subtopic dropdowns. Perfect for:
- Analytics pages that need drill-down
- Any page with hierarchical data
- Pages where users need to narrow results

### include_table

Adds a sortable table with:
- Column headers with sort indicators
- Hover effects
- Action buttons
- Modern styling

Alternative: Without table, you get a responsive card grid.

### include_modal

Adds a modal dialog system for:
- Showing detailed information
- Confirmation dialogs
- Forms or wizards
- Any overlay UI

## Common Customizations

### Add a New Filter

```svelte
<div class="filter-group">
    <label class="filter-label" for="status-filter">Status</label>
    <select id="status-filter" bind:value={statusFilter} class="modern-select">
        <option value="">All Statuses</option>
        <option value="active">Active</option>
        <option value="completed">Completed</option>
    </select>
</div>
```

### Add Table Columns

```svelte
<!-- In <thead> -->
<th>
    <button class="sort-btn" on:click={() => sortBy('status')}>
        Status
        {#if sortColumn === 'status'}
            <span class="sort-indicator {sortDirection}">▼</span>
        {/if}
    </button>
</th>

<!-- In <tbody> -->
<td>{item.status || 'N/A'}</td>
```

### Change Layout Type

Simply change the `route_type` in the CSS class names and adjust spacing/layout as needed.

## Tips

1. **Start Simple**: Begin with filters=no, table=no, modal=no, then add as needed
2. **Copy Patterns**: Look at existing routes like `/analytics/mock_exam_metrics` for examples
3. **Consistent Naming**: Use snake_case for route names (they become folder names)
4. **Test Mobile**: Always check responsive breakpoints
5. **Keep User Context**: The template uses `currentDiscipline` and `currentOrg` - maintain this pattern

## Regeneration

If you need to regenerate with different options:

```bash
# Delete the old folder
rm -rf user_progress

# Generate again with new options
cookiecutter cc_kaizen_routes
```

## Advanced: Non-Interactive Mode

Create a `config.yaml`:

```yaml
default_context:
  route_name: "batch_route"
  route_display_name: "Batch Route"
  route_description: "Generated in batch mode"
  route_type: "analytics"
  include_filters: "yes"
  include_table: "yes"
  include_modal: "no"
```

Then:

```bash
cookiecutter cc_kaizen_routes --no-input --config-file config.yaml
```

Perfect for scripting or CI/CD.
