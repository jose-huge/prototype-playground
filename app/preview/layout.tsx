export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Hide the Next.js dev indicator inside preview iframes — it shows in
          the main window already and would double up inside the simulated browser. */}
      <style>{`
        nextjs-portal { display: none !important; }
        html, body {
          background: #0a0a0a;
          margin: 0;
          padding: 0;
        }
      `}</style>
      {children}
    </>
  );
}
