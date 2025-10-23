.PHONY: help install test clean generate-analytics generate-dashboard generate-list

# Default target
help:
	@echo "Kaizen Route Cookiecutter Template"
	@echo ""
	@echo "Available targets:"
	@echo "  make install              - Install cookiecutter and dependencies"
	@echo "  make test                 - Run automated tests"
	@echo "  make clean                - Clean up test artifacts"
	@echo "  make generate-analytics   - Generate example analytics route"
	@echo "  make generate-dashboard   - Generate example dashboard route"
	@echo "  make generate-list        - Generate example list route"
	@echo ""
	@echo "Manual generation:"
	@echo "  cd .. && cookiecutter cc_kaizen_routes"

# Install dependencies
install:
	@echo "📦 Installing cookiecutter and dependencies..."
	pip install -r requirements.txt
	@echo "✅ Installation complete"

# Run tests
test:
	@echo "🧪 Running template tests..."
	./test_template.sh

# Clean test artifacts
clean:
	@echo "🧹 Cleaning up..."
	rm -rf example_analytics example_dashboard example_list
	rm -rf test_* my_feature
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	@echo "✅ Cleanup complete"

# Generate example analytics route
generate-analytics:
	@echo "📝 Generating analytics route example..."
	cd .. && cookiecutter cc_kaizen_routes --no-input --config-file cc_kaizen_routes/examples/analytics_route.yaml
	@echo "✅ Generated: example_analytics/"
	@echo "   Move with: mv example_analytics src/routes/"

# Generate example dashboard route
generate-dashboard:
	@echo "📝 Generating dashboard route example..."
	cd .. && cookiecutter cc_kaizen_routes --no-input --config-file cc_kaizen_routes/examples/dashboard_route.yaml
	@echo "✅ Generated: example_dashboard/"
	@echo "   Move with: mv example_dashboard src/routes/"

# Generate example list route
generate-list:
	@echo "📝 Generating list route example..."
	cd .. && cookiecutter cc_kaizen_routes --no-input --config-file cc_kaizen_routes/examples/simple_list.yaml
	@echo "✅ Generated: example_list/"
	@echo "   Move with: mv example_list src/routes/"
