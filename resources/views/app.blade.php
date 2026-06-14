<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <title>RTSAtlas Engine</title>
        @vite('resources/js/app.js')
        <x-inertia::head />
        <style>
            * { box-sizing: border-box; }
            html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: #030712; }
        </style>
    </head>
    <body>
        <x-inertia::app />
    </body>
</html>