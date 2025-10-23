#!/usr/bin/env python
"""
Post-generation hook for Kaizen route template.
Displays helpful next steps after template generation.
"""

import os

# Get template variables
ROUTE_NAME = "{{ cookiecutter.route_name }}"
ROUTE_DISPLAY_NAME = "{{ cookiecutter.route_display_name }}"
ROUTE_TYPE = "{{ cookiecutter.route_type }}"
INCLUDE_FILTERS = "{{ cookiecutter.include_filters }}" == "yes"
INCLUDE_TABLE = "{{ cookiecutter.include_table }}" == "yes"
INCLUDE_MODAL = "{{ cookiecutter.include_modal }}" == "yes"

# ANSI color codes
GREEN = "\033[92m"
BLUE = "\033[94m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

def print_success():
    """Print success message with next steps."""
    print(f"\n{GREEN}{BOLD}✓ Route '{ROUTE_NAME}' generated successfully!{RESET}\n")

    print(f"{CYAN}{BOLD}Generated Components:{RESET}")
    print(f"  • Page type: {ROUTE_TYPE}")
    if INCLUDE_FILTERS:
        print(f"  • {GREEN}✓{RESET} Cascading filters (Subject/Topic/Subtopic)")
    if INCLUDE_TABLE:
        print(f"  • {GREEN}✓{RESET} Sortable table")
    if INCLUDE_MODAL:
        print(f"  • {GREEN}✓{RESET} Modal dialog")

    print(f"\n{YELLOW}{BOLD}Next Steps:{RESET}")
    print(f"  1. Move the route to your SvelteKit project:")
    print(f"     {BLUE}mv {ROUTE_NAME} src/routes/{RESET}")
    print(f"     {BLUE}# Or: mv {ROUTE_NAME} src/routes/analytics/{RESET}")

    print(f"\n  2. Update the data fetching logic:")
    print(f"     Open: {BLUE}{ROUTE_NAME}/+page.svelte{RESET}")
    print(f"     Find: {BLUE}await supabase.rpc('your_rpc_function_here', ...){RESET}")
    print(f"     Replace with your actual RPC function")

    print(f"\n  3. Customize the display:")
    if INCLUDE_TABLE:
        print(f"     • Update table columns to match your data structure")
    else:
        print(f"     • Update card fields to match your data structure")

    print(f"\n  4. Test your route:")
    print(f"     {BLUE}http://localhost:5173/{ROUTE_NAME}{RESET}")

    print(f"\n{CYAN}{BOLD}Tips:{RESET}")
    print(f"  • User authentication is already configured")
    print(f"  • Loading and error states are built-in")
    print(f"  • Responsive design works on all devices")
    print(f"  • Muted purple theme is pre-applied")

    print(f"\n{BOLD}For more help, see:{RESET}")
    print(f"  • {BLUE}cc_kaizen_routes/README.md{RESET} - Full documentation")
    print(f"  • {BLUE}cc_kaizen_routes/USAGE.md{RESET} - Quick start guide")
    print(f"  • {BLUE}src/routes/analytics/{RESET} - Example routes\n")

if __name__ == "__main__":
    print_success()
