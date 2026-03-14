import './globals.css';

export const metadata = {
  title: 'Dashboard RipnoteTech',
  description: 'Control menu'
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
