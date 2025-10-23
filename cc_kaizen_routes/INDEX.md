# 📋 Kaizen Route Generator - Index

Welcome to the Kaizen Route Cookiecutter Template! This index helps you find the right documentation.

## 🎯 I Want To...

### Get Started Quickly
➡️ **[QUICKSTART.md](QUICKSTART.md)** - Generate your first route in 60 seconds

### Understand How to Use It
➡️ **[USAGE.md](USAGE.md)** - Detailed usage guide with examples

### Learn About All Features
➡️ **[README.md](README.md)** - Complete documentation

### Understand the Technical Details
➡️ **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** - Architecture and design

## 📁 File Guide

| File | Purpose |
|------|---------|
| `cookiecutter.json` | Template configuration with all options |
| `requirements.txt` | Python dependencies |
| `{{cookiecutter.route_name}}/+page.svelte` | The actual template file (817 lines) |
| `hooks/post_gen_project.py` | Success message after generation |
| `examples/*.yaml` | Pre-configured route examples |
| `test_template.sh` | Automated testing |
| `Makefile` | Convenient make targets |
| `.gitignore` | Git ignore patterns |

## 🛠️ Common Commands

```bash
# Install
make install

# Generate interactively
cd .. && cookiecutter cc_kaizen_routes

# Generate from preset
make generate-analytics
make generate-dashboard
make generate-list

# Test
make test

# Clean
make clean

# Help
make help
```

## 🎨 Template Options

### Route Types
- **analytics** - Data-heavy pages with metrics
- **dashboard** - Overview pages with cards
- **form** - Data entry pages
- **list** - Browse collections

### Optional Features
- **Filters** - Cascading Subject/Topic/Subtopic dropdowns
- **Table** - Sortable data table
- **Modal** - Detail dialog overlays

### Colors
- **Primary**: `#a855f7` (muted purple)
- **Secondary**: `#8b5cf6` (darker purple)
- **Accent**: `#14b8a6` (teal)

## 📦 What Gets Generated

Each route includes:

✅ **Authentication** - User state management, login guards
✅ **Data Fetching** - Supabase RPC integration
✅ **Loading States** - Spinner, error, empty states
✅ **Responsive Design** - Mobile, tablet, desktop
✅ **Modern Styling** - Gradients, shadows, animations
✅ **Accessibility** - ARIA labels, semantic HTML
✅ **Type Safety** - TypeScript with proper types

## 🔧 After Generation

1. Move route to `src/routes/`
2. Update RPC function name
3. Customize table columns / card fields
4. Test at `http://localhost:5173/your-route`

## 📚 Examples

### Analytics Page
```yaml
route_type: analytics
include_filters: yes
include_table: yes
include_modal: yes
```
**Use for**: Metrics, reports, performance tracking

### Dashboard
```yaml
route_type: dashboard
include_filters: no
include_table: no
include_modal: yes
```
**Use for**: Overviews, summaries, key metrics

### Simple List
```yaml
route_type: list
include_filters: no
include_table: yes
include_modal: no
```
**Use for**: Browse records, search results

## 🐛 Troubleshooting

### Template won't generate
```bash
# Reinstall dependencies
pip install -r requirements.txt --force-reinstall
```

### Route not found (404)
- Ensure folder is in `src/routes/`
- Check SvelteKit is running (`npm run dev`)

### Styles not showing
- Verify `src/lib/styles/purpley.css` exists
- Check global `app.css` imports

### Data not loading
- Check browser console for errors
- Verify RPC function name is correct
- Ensure user is authenticated

## 🤝 Contributing

To improve this template:
1. Edit files in `cc_kaizen_routes/`
2. Test with `./test_template.sh`
3. Update documentation
4. Commit changes

## 📖 Learn More

- **SvelteKit Docs**: https://kit.svelte.dev/
- **Cookiecutter Docs**: https://cookiecutter.readthedocs.io/
- **Kaizen Routes**: See `src/routes/analytics/` for examples

---

**Ready to start?** → [QUICKSTART.md](QUICKSTART.md)
