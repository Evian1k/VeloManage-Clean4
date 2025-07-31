# AutoCare Pro

A premium car management system built with React, featuring real-time service tracking, automated reminders, and comprehensive admin controls.

## 🚗 Features

### User Features
- **Vehicle Management**: Add and manage multiple vehicles
- **Service Requests**: Submit service requests with detailed information
- **Real-time Tracking**: Track service status and progress
- **Service History**: View complete service history for all vehicles
- **Notifications**: Receive updates on service status
- **Dashboard**: Comprehensive overview of vehicles and services

### Admin Features
- **Request Management**: Approve, manage, and update service requests
- **Status Updates**: Real-time status updates for ongoing services
- **Analytics Dashboard**: View system statistics and metrics
- **User Management**: Oversee user accounts and activities
- **Messaging System**: Communicate with customers

## 🛠 Technology Stack

- **Frontend**: React 18, Vite
- **UI Framework**: Tailwind CSS, Radix UI
- **Animations**: Framer Motion
- **Routing**: React Router DOM
- **State Management**: React Context API
- **Icons**: Lucide React

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/autocare-pro.git
cd autocare-pro
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

### Build for Production

```bash
npm run build
npm run preview
```

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Base UI components (buttons, inputs, etc.)
│   ├── user/           # User-specific components
│   └── admin/          # Admin-specific components
├── contexts/           # React Context providers
├── pages/              # Page components
├── lib/                # Utility functions
└── styles/             # Global styles
```

## 🔐 Authentication

The application includes role-based authentication with two user types:

- **Regular Users**: Can manage vehicles and submit service requests
- **Admin Users**: Can manage all requests and access administrative features

### Admin Access
Admin users are identified by specific email addresses defined in the system.

## 🎨 UI Components

The project uses a custom component library built on top of Radix UI primitives:

- Buttons, Cards, Dialogs
- Form inputs and selects
- Tabs and navigation
- Toast notifications
- Loading states

## 📱 Responsive Design

AutoCare Pro is fully responsive and works seamlessly across:
- Desktop computers
- Tablets
- Mobile devices

## 🔧 Development

### Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Customization

The application can be customized through:
- Tailwind configuration (`tailwind.config.js`)
- Vite configuration (`vite.config.js`)
- CSS variables in `src/index.css`

## 🚦 Current Limitations

This is a frontend-only prototype. For production use, you'll need:

- Backend API server
- Database integration
- Real authentication system
- File upload capabilities
- Email/SMS notifications
- Payment processing

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation in the `/docs` folder
- Review the component examples in the codebase

## 🔮 Roadmap

- [ ] Backend API integration
- [ ] Real-time notifications
- [ ] File upload system
- [ ] Payment processing
- [ ] Mobile app (React Native)
- [ ] Advanced analytics
- [ ] Multi-language support

---

