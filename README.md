# Hierarchical A* (HAA*) Pathfinding Demo

Interactive demonstration of Hierarchical A* pathfinding algorithm using maze generation and visualization.

## Features

- ⚛️ React with TypeScript
- 🎨 Tailwind CSS for styling
- 🧩 MST-based maze generation using Kruskal's algorithm
- 🗺️ Hierarchical A* (HAA*) pathfinding implementation
- 🎯 Interactive start/end point selection
- 🌈 Connected component visualization within regions
- 📱 Responsive design
- 🚀 GitHub Pages deployment
- 🤖 One-click automated deployment


## Quick Start
1. First-time setup:
   ```
   npm run init-and-deploy
   ```
   You'll be prompted to enter a repository name, or you can provide one directly:
   ```
   npm run init-and-deploy -- --repo-name="my-awesome-app"
   ```

2. For subsequent updates, simply run:
   ```
   npm run auto-deploy
   ```

Your app will be available at the URL provided in the console output.

## Development

- Start the development server:
  ```
  npm start
  ```
- Build for production:
  ```
  npm run build
  ```
- Deploy changes to GitHub Pages:
  ```
  npm run deploy
  ```

## Customization

- Modify the components in the `src` directory
- Customize Tailwind CSS in `tailwind.config.js`
- Update the page title and metadata in `public/index.html`

## Troubleshooting

If the initialization fails:

- Make sure GitHub CLI is installed: `gh --version`
- Make sure you're logged in to GitHub: `gh auth status`
- Check error messages in the console output

## License

MIT