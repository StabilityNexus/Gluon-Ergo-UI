# Gluon Ergo UI

A modern DeFi interface built with Next.js, Tailwind CSS, Shadcn UI, Zustand, Framer Motion, and bun as package manager.

## 📝 TODO

- [ ] Setup Eslint and Prettier rules
- [x] Setup shadcn/ui theming 
- [x] Setup theme switcher
- [ ] Rework the homepage to be more dynamic and modern 
- [x] Create layout components (navbar, footer, sidebar, etc)
- [x] Implement Nautilus Wallet connector 
- [ ] Implement ErgoPay Connector
- [~] Implement Ergo Gluon SDK 
- [x] Rework the dashboard
- [ ] Handle wallet logic for testnet / mainnet
- [x] Handle Gluon information based on SDK availability 

## 🚀 Getting Started

Install bun, if you don't have it already, you can find it [here](https://bun.sh/docs/installation). 

If you don't want to use bun, you can always use NPM or PNPM. 

1. Install dependencies:
```bash
bun install
```

2. Start the development server:
```bash
bun dev
```

### Adding Shadcn Components

To install new shadcn components:
```bash
bun x shadcn@latest add <component-name>
```

or with NPM / PNPM:

```bash
npx shadcn@latest add <component-name>
```

While working with shadcn, all components are installed to src/lib/components/ui
You will have access to the core component file, which means you can edit the core file as you please. 

> ⚠️ **Note:** Avoid reinstalling existing components when prompted, as this will reset any custom styling in the component files.

## 📁 Folder Structure

The project follows a modular approach. Components or functions that will be used multiple times should be designed to accept various props or be moved to separate files.

### Directory Overview
```
src/
├── lib/         # Components, utils, hooks, etc.
├── pages/       # Next.js pages
└── styles/      # Global styles
```

### Component Organization Guidelines

- **UI Components**: All shadcn-related components go in `lib/components/ui`
- **Page Sections**: Add page-specific sections (e.g., homepage header) in `components/blocks`
- **Layout Components**: Place layout elements (navbar, sidebar, footer) in `components/layout`
- **New Features**: Create dedicated folders in appropriate locations (e.g., `lib/components/carousel/TokensDisplay.tsx`)

## 🏷️ Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Small UI Components | kebab-case | `my-new-component.tsx` → export as `YourComponent` |
| Complex Components | PascalCase | `ThisComponentName.tsx` |
| Functions | camelCase | `useThisFunction.ts`, `getThisValue.ts` |
| Constants | UPPERCASE | `LIKE_THIS.ts` |

## 🔄 Pull Request Workflow

### Branch Structure
- `mainnet` - Production branch
- `testnet` - Development & testing branch

### Development Process
1. Create feature branches from `testnet`: `testnet/feature-name`
2. Submit PR to `testnet` with detailed description
3. After testing on testnet deployment, it will be merged to `mainnet`
4. It is possible that feature branches will be deleted after merging to mainnet.

### Environment Handling [TODO]
Use environment variables for network detection and write code that is compatible with both testnet and mainnet, i.e:
```typescript
if (process.env.NEXT_PUBLIC_NETWORK === 'testnet') {
    // testnet-specific code
}
```

## 💡 Best Practices

### TypeScript Guidelines
- Type everything possible to improve code quality
- Avoid unnecessary interfaces
- Keep type definitions simple and practical for day to day reading
- Try to add types to src/lib/types to keep the codebase clean and organized

### Collaborative Development
- Follow established conventions
- Respect team members' work
- Share and discuss implementation ideas
- Maintain a clean and organized codebase

---

For questions or discussions, please join our Discord community.