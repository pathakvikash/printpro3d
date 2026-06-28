# PrintPro3D: Online 3D Printing Service Frontend

This is a modern, responsive web frontend for an online 3D printing service, built with [Next.js](https://nextjs.org), TypeScript, and Tailwind CSS.

## Key Features

- **User Registration/Login**: Secure authentication and profile management.
- **3D Model Upload**: Upload STL/OBJ files and preview them interactively (WebGL/Three.js).
- **Material & Finish Selection**: Choose from a variety of materials and finishes.
- **Real-Time Price Estimates**: Get instant pricing as you configure your print.
- **Checkout & Payment**: Seamless checkout with payment integration (e.g., Stripe).
- **Order Tracking**: Track your order status and history.
- **Admin Dashboard**: Manage orders and site content with a clean UI.
- **API Integration**: Connects to backend for pricing, order, and user management.
- **Responsive Design**: Works great on desktop and mobile.

---

## Getting Started

## Getting Started

First, install dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
```

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the main page by modifying `src/app/page.tsx`. The page auto-updates as you edit the file.

---

## Project Structure

- `src/app/` - Main app pages and routing
- `src/components/` - Reusable UI components
- `src/styles/` - Tailwind and global styles
- `src/utils/` - Utility functions and API integration

---

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Three.js Documentation](https://threejs.org/docs/)
- [Stripe Integration](https://stripe.com/docs)

---

## License

MIT
