#!/bin/bash

# Get the directory where the script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Change to the backend directory
cd "$DIR"

# Activate virtual environment if it exists
if [ -d "../venv" ]; then
    source ../venv/bin/activate
fi

# Set the Python path to include the backend directory
export PYTHONPATH=$PYTHONPATH:$DIR

# Set Django settings module
export DJANGO_SETTINGS_MODULE=config.settings

# Run Daphne
exec daphne -b 0.0.0.0 -p 8000 config.asgi:application 