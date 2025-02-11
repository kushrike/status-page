web: cd backend && daphne -b 0.0.0.0 -p $PORT config.asgi:application
worker: cd backend && celery -A config worker --loglevel=info
beat: cd backend && celery -A config beat --loglevel=info 