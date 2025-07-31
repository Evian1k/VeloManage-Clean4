# Development Guide

This guide will help you set up and contribute to the AutoCare Pro project.

## 🛠 Prerequisites

- **Node.js**: Version 18 or higher
- **npm**: Version 8 or higher (comes with Node.js)
- **Git**: For version control

## 🚀 Quick Setup

1. **Clone the repository**
```bash
git clone https://github.com/your-username/autocare-pro.git
cd autocare-pro
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

4. **Start development server**
```bash
npm run dev
```

5. **Open your browser**
Navigate to `http://localhost:5173`

## 📁 Project Structure

```
autocare-pro/
├── public/                 # Static assets
├── src/
│   ├── components/        # React components
│   │   ├── ui/           # Base UI components
│   │   ├── user/         # User-specific components
│   │   └── admin/        # Admin-specific components
│   ├── contexts/         # React Context providers
│   ├── lib/              # Utility functions and configurations
│   ├── pages/            # Page components (routes)
│   ├── App.jsx           # Main application component
│   ├── main.jsx          # Application entry point
│   └── index.css         # Global styles
├── tools/                # Build tools and scripts
├── docs/                 # Documentation
└── package.json          # Project configuration
```

## 🎯 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues automatically
- `npm run clean` - Clean build artifacts
- `npm run check` - Run all checks (lint + build)

## 🧩 Component Architecture

### UI Components (`src/components/ui/`)
Base components built on Radix UI primitives:
- Button, Card, Dialog, Input, Select, etc.
- Consistent styling with Tailwind CSS
- Fully accessible by default

### Feature Components
- **User Components**: Dashboard, profile, service requests
- **Admin Components**: Request management, analytics
- **Shared Components**: Navigation, notifications

### Context Providers
- **AuthContext**: Authentication state and methods
- **ServiceContext**: Service requests and vehicle data
- **MessageContext**: Notifications and messaging

## 🎨 Styling Guidelines

### Tailwind CSS
- Primary color: Red (`red-600`, `red-700`, etc.)
- Dark theme with gradients
- Responsive design (`sm:`, `md:`, `lg:` prefixes)

### Component Styling
```jsx
// Use cn() utility for conditional classes
import { cn } from '@/lib/utils';

const Button = ({ className, variant = 'default', ...props }) => {
  return (
    <button
      className={cn(
        'base-button-classes',
        variant === 'primary' && 'primary-variant-classes',
        className
      )}
      {...props}
    />
  );
};
```

## 🔧 Development Workflow

### 1. Feature Development
```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "feat: add your feature description"

# Push and create PR
git push origin feature/your-feature-name
```

### 2. Code Quality
- **ESLint**: Automatic code linting
- **Prettier**: Code formatting (recommended)
- **Pre-commit hooks**: Run checks before commits

### 3. Testing (Future Implementation)
```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage
```

## 📝 Coding Standards

### JavaScript/React
- Use functional components with hooks
- Prefer arrow functions for consistency
- Use destructuring for props and state
- Follow React best practices

### File Naming
- Components: `PascalCase.jsx`
- Utilities: `camelCase.js`
- Constants: `UPPER_SNAKE_CASE`
- Pages: `PascalCase.jsx`

### Import Organization
```jsx
// 1. React and external libraries
import React, { useState } from 'react';
import { motion } from 'framer-motion';

// 2. Internal components
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';

// 3. Context and hooks
import { useAuth } from '@/contexts/AuthContext';

// 4. Utilities and constants
import { formatDate } from '@/lib/utils';
import { ROUTES } from '@/lib/constants';
```

## 🔐 Security Considerations

### Input Validation
- Always validate user inputs
- Use the validation library in `src/lib/validations.js`
- Sanitize data before storage

### Authentication
- Currently uses localStorage (development only)
- Production requires proper JWT implementation
- Admin access controlled by email whitelist

### Data Handling
- Never expose sensitive data in frontend
- Validate all form submissions
- Use HTTPS in production

## 🚀 Deployment

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm run preview
```

### Environment Variables
Create `.env.local` with required variables:
```env
VITE_APP_NAME=AutoCare Pro
VITE_API_BASE_URL=https://api.autocare.com
# Add other required variables
```

## 🐛 Debugging

### Development Tools
- React Developer Tools
- Redux DevTools (if using Redux)
- Browser DevTools Console

### Common Issues
1. **Module not found**: Check import paths and aliases
2. **Build failures**: Check for TypeScript errors or missing dependencies
3. **Styling issues**: Verify Tailwind classes and CSS imports

### Error Boundaries
The app includes error boundaries for graceful error handling:
- Development: Shows detailed error information
- Production: Shows user-friendly error messages

## 📚 Resources

### Documentation
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [Radix UI](https://www.radix-ui.com)

### Learning Materials
- [React Patterns](https://reactpatterns.com)
- [JavaScript Style Guide](https://github.com/airbnb/javascript)
- [Git Flow](https://github.com/nvie/gitflow)

## 🤝 Contributing

### Before Contributing
1. Read this development guide
2. Check existing issues and PRs
3. Follow coding standards
4. Write meaningful commit messages

### Pull Request Process
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests (when available)
5. Update documentation
6. Submit pull request

### Code Review
- All PRs require review
- Address feedback promptly
- Keep PRs small and focused
- Include screenshots for UI changes

## 📞 Getting Help

- **Issues**: Create GitHub issues for bugs
- **Discussions**: Use GitHub discussions for questions
- **Documentation**: Check the `/docs` folder
- **Code Examples**: Review existing components

---

Happy coding! 🚗✨