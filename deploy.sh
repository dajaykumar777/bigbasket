#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# deploy.sh  —  Build and deploy Big Basket Shop to Firebase
# Spark (free) plan — no Functions, no Storage needed.
# Run with:  bash deploy.sh
# ─────────────────────────────────────────────────────────────
set -e

echo "�  Installing dependencies..."
npm install

echo "�🔨  Building frontend..."
npm run build

echo "🚀  Deploying to Firebase (Hosting + Firestore rules)..."
firebase deploy --only hosting,firestore

echo "✅  Deployment complete!"
