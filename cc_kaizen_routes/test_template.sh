#!/bin/bash
# Quick test script to verify cookiecutter template works
# Usage: ./test_template.sh

set -e

echo "🧪 Testing Kaizen Route Template..."
echo ""

# Check if cookiecutter is installed
if ! command -v cookiecutter &> /dev/null; then
    echo "❌ cookiecutter not found. Installing..."
    pip install -r requirements.txt
fi

# Test with example config
echo "📝 Generating test route with analytics config..."
cookiecutter . --no-input --config-file examples/analytics_route.yaml

if [ -d "example_analytics" ]; then
    echo "✅ Analytics route generated successfully"

    # Check if the file exists and is valid
    if [ -f "example_analytics/+page.svelte" ]; then
        echo "✅ +page.svelte created"

        # Basic validation - check for key content
        if grep -q "example_analytics-container" "example_analytics/+page.svelte"; then
            echo "✅ Template variables resolved correctly"
        else
            echo "❌ Template variables not resolved"
            exit 1
        fi
    else
        echo "❌ +page.svelte not created"
        exit 1
    fi

    # Cleanup
    echo ""
    echo "🧹 Cleaning up test files..."
    rm -rf example_analytics
    echo "✅ Cleanup complete"
else
    echo "❌ Route generation failed"
    exit 1
fi

echo ""
echo "🎉 All tests passed! Template is ready to use."
echo ""
echo "Try it yourself:"
echo "  cookiecutter cc_kaizen_routes"
