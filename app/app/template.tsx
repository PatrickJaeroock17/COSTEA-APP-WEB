/** Transición breve al cambiar de página: solo el contenido (el menú queda fuera). Ver `.enter-page` en globals.css. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="enter-page">{children}</div>;
}
