import Link from "next/link";

export default function NotFound() {
  return <main className="not-found"><span className="nf-code">404</span><h1>That receipt went missing.</h1><p>The page is not here. Head back to the start and check another path.</p><Link className="button button-lime" href="/">Back to Tikdam <span aria-hidden="true">↗</span></Link></main>;
}
