# 🚀 Quick Start

Generate a new Kaizen route in 60 seconds.

## 1️⃣ Install

```bash
cd cc_kaizen_routes
pip install -r requirements.txt
```

## 2️⃣ Generate

```bash
cd ..
cookiecutter cc_kaizen_routes
```

Answer the prompts:
- **route_name**: `user_stats`
- **route_display_name**: `User Statistics`
- **route_type**: `1` (analytics)
- **include_filters**: `1` (yes)
- **include_table**: `1` (yes)
- **include_modal**: `2` (no)

## 3️⃣ Move to Project

```bash
mv user_stats src/routes/analytics/
```

## 4️⃣ Update Data Logic

Edit `src/routes/analytics/user_stats/+page.svelte`:

```typescript
// Find this line (around line 95):
const { data: result, error } = await supabase.rpc('your_rpc_function_here', {

// Replace with your actual function:
const { data: result, error } = await supabase.rpc('get_user_statistics', {
    p_user_id: user.user_id,
    p_discipline_id: currentDiscipline.discipline_id
});
```

## 5️⃣ Test

```bash
# Start dev server (if not running)
npm run dev

# Open in browser
http://localhost:5173/analytics/user_stats
```

---

## ⚡ Even Faster: Use Presets

```bash
# Analytics route with filters + table + modal
make generate-analytics

# Dashboard with card grid + modal
make generate-dashboard

# Simple list with table
make generate-list
```

---

## 📚 Full Documentation

- **README.md** - Complete documentation
- **USAGE.md** - Detailed usage guide
- **PROJECT_SUMMARY.md** - Technical overview

---

## ✨ What You Get

✅ Full TypeScript + Svelte route
✅ User authentication built-in
✅ Muted purple theme styling
✅ Loading & error states
✅ Responsive design
✅ Optional filters, tables, modals
✅ 817 lines of production-ready code

**Time to implement from scratch**: 2-3 hours
**Time with template**: 5 minutes
