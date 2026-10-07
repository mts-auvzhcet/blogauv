import React, { createContext, useContext, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import './styles.css';
import './pages.css';

const CATEGORIES = ['Computer Science', 'Electronics', 'Mechanical'];
const CATEGORY_COPY = {
  'Computer Science': 'Code, computation & the human side of technology.',
  Electronics: 'The invisible circuits connecting everything.',
  Mechanical: 'Forces, forms & how the physical world works.',
};
const CATEGORY_SHORT = { 'Computer Science': 'CS', Electronics: 'EE', Mechanical: 'ME' };
const AuthContext = createContext(null);

function LoadingState({ message = 'Loading articles' }) {
  return <main className="loader-stage" role="status" aria-live="polite"><div className="loader-noise" /><div className="longfazers" aria-hidden="true"><span /><span /><span /><span /></div><div className="loader-brand"><Brand /></div><div className="loader-center"><div className="loader-scene" aria-hidden="true"><div className="loader"><span className="speed-bar"><i /><i /><i /><i /></span><div className="base"><span /><i className="face" /></div></div></div><div className="loader-copy"><p className="eyebrow">FIELD NOTES / 01</p><h1>{message}</h1><p>Preparing the latest from the workbench</p><div className="loading-meter"><span /></div></div></div><div className="loader-caption">MTS AUV-ZHCET <span>·</span> AMU CLUB JOURNAL</div></main>;
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(path, { credentials: 'same-origin', ...options, headers });
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`The server returned a webpage instead of API data for ${path}. Check that the Vercel project was deployed from the repository root.`);
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The request could not be completed.');
  return result;
}

function AuthProvider({ children }) {
  const [auth, setAuth] = useState({ loading: true, admin: null, csrfToken: '' });
  useEffect(() => {
    api('/api/admin/session').then((result) => setAuth({ loading: false, ...result }))
      .catch(() => setAuth({ loading: false, admin: null, csrfToken: '' }));
  }, []);
  async function signIn(username, password) {
    const result = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    setAuth({ loading: false, ...result });
  }
  async function signOut() {
    await api('/api/admin/logout', { method: 'POST', headers: { 'X-CSRF-Token': auth.csrfToken } });
    setAuth({ loading: false, admin: null, csrfToken: '' });
  }
  return <AuthContext.Provider value={{ ...auth, signIn, signOut }}>{children}</AuthContext.Provider>;
}

function useAuth() { return useContext(AuthContext); }

function Brand() {
  return <Link className="brand" data-rev to="/" aria-label="MTS AUV-ZHCET Club Blog home"><img className="brand-emblem" src="/club-emblem.png" alt="" /><span className="brand-copy"><strong>MTS AUV-ZHCET</strong><span>CLUB BLOG</span></span></Link>;
}

function PublicHeader() {
  return <header className="topbar"><Brand /><nav className="nav-links" aria-label="Main navigation"><a data-rev href="/#fields">Fields</a><a data-rev href="/#latest">Reading room</a></nav><Link className="nav-cta" data-rev to="/about">About the club <span>↗</span></Link></header>;
}

function Footer() {
  return <footer className="footer"><Brand /><span data-rev>Ideas from the workbench at ZHCET.</span><span data-rev>© 2026 MTS AUV-ZHCET · AMU</span></footer>;
}

function HeroArt() {
  return <div className="hero-art" aria-label="Abstract engineering-inspired artwork"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-grid" /><div className="art-ring ring-one" /><div className="art-ring ring-two" /><div className="art-core"><span>AUV</span><i>✳</i></div><span className="art-coordinate coord-a">40° 42′ 46.0″ N</span><span className="art-coordinate coord-b">74° 00′ 21.0″ W</span><span className="art-label">FIG. 01 — SYSTEMS IN MOTION</span><span className="art-spark spark-one">✳</span><span className="art-spark spark-two">✦</span></div>;
}

function ArticleArtwork({ category, index = 1 }) {
  const className = category === 'Electronics' ? 'art-electronics' : category === 'Mechanical' ? 'art-mechanical' : 'art-cs';
  const glyph = category === 'Electronics' ? '⌁' : category === 'Mechanical' ? 'σ = F / A' : '{ }';
  return <div className={`article-art ${className}`}><span className="mini-code">{String(index).padStart(2, '0')} / {CATEGORY_SHORT[category]}</span><span className="article-art-glyph">{glyph}</span></div>;
}

function Avatar({ author }) {
  const initials = (author || 'AUV').slice(0, 2).toUpperCase();
  return <span className="avatar">{initials}</span>;
}

function ArticleRow({ post, index }) {
  const date = new Date(post.createdAt).toLocaleDateString('en', { year: 'numeric', month: 'short', day: '2-digit' });
  return <article className="article-row reveal-on-scroll"><Link className="article-art-link" to={`/${post.slug}/`} aria-label={`Read ${post.title}`}><ArticleArtwork category={post.category} index={index} /></Link><div className="article-content"><div className="article-meta"><span className="tag">{post.category.toUpperCase()}</span><span>ARTICLE</span></div><h3><Link to={`/${post.slug}/`}>{post.title}</Link></h3><p data-rev>{post.excerpt}</p><div className="byline"><Avatar author={post.author} /><span>{post.author}</span><span className="byline-divider">·</span><span>{date}</span></div></div><Link className="row-arrow" to={`/${post.slug}/`} aria-label="Open article">↗</Link></article>;
}

function BlogCard({ post, index }) {
  const readMinutes = Math.max(1, Math.ceil((post.markdown || '').split(/\s+/).length / 220));
  return <Link className="blog-card" to={`/${post.slug}/`} data-rev><ArticleArtwork category={post.category} index={index} /><div className="blog-card-body"><div className="blog-card-meta"><span>{post.category}</span><span>{readMinutes} MIN READ</span></div><h2>{post.title}</h2><p>{post.excerpt}</p><div className="blog-card-foot"><span>{post.author}</span><span>READ ARTICLE ↗</span></div></div></Link>;
}

function WordLine({ children, className = '', as: Tag = 'span' }) {
  const words = String(children).split(/\s+/);
  return <Tag className={`word-line ${className}`} aria-label={String(children)}>{words.map((word, index) => <React.Fragment key={`${word}-${index}`}><span className="word-atom" data-rev style={{ '--word-delay': `${index * 38}ms` }} aria-hidden="true">{word}</span>{index < words.length - 1 ? ' ' : null}</React.Fragment>)}</Tag>;
}

function PlateCanvas({ variant = 'soil', className = '', animate = false }) {
  const canvasRef = React.useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const context = canvas.getContext('2d');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let width = 0;
    let height = 0;
    const resize = () => {
      cancelAnimationFrame(frame);
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw(0);
    };
    const draw = (time) => {
      if (!width || !height) return;
      context.clearRect(0, 0, width, height);
      if (variant === 'soil') {
        const cols = 32;
        const rows = 24;
        for (let index = 0; index < cols * rows; index += 1) {
          const col = index % cols;
          const row = Math.floor(index / cols);
          const drift = animate && !reduced ? Math.sin(time * 0.00022 + index * 0.7) * 8 : 0;
          const x = (col + 0.5) * width / cols + drift;
          const y = (row + 0.5) * height / rows + Math.cos(index * 1.7 + time * 0.00018) * (animate && !reduced ? 2 : 0);
          context.beginPath(); context.moveTo(x, y); context.lineTo(x + 4 + index % 9, y - 2 - index % 3);
          context.strokeStyle = `rgba(239,73,60,${0.05 + (index % 15) / 100})`; context.lineWidth = 1; context.stroke();
        }
      } else if (variant === 'contour') {
        for (let line = 0; line < 22; line += 1) {
          context.beginPath();
          for (let x = 0; x <= width; x += 4) {
            const normalized = x / Math.max(width, 1);
            const harmonic = Math.sin(normalized * 8 + line * 0.31 + time * (animate && !reduced ? 0.00008 : 0)) * 14;
            const slow = Math.sin(normalized * 3.1 + line * 0.12) * 8;
            const y = 8 + line * height / 21 + harmonic + slow;
            if (x === 0) context.moveTo(x, y); else context.lineTo(x, y);
          }
          context.strokeStyle = line % 5 === 0 ? 'rgba(185,39,37,.40)' : 'rgba(23,23,23,.19)';
          context.lineWidth = line % 5 === 0 ? 1.2 : 0.8; context.stroke();
        }
      } else {
        const count = variant === 'electronics' ? 8 : 13;
        context.strokeStyle = variant === 'electronics' ? 'rgba(185,39,37,.72)' : 'rgba(23,23,23,.62)';
        context.lineWidth = 1;
        for (let index = 0; index < count; index += 1) {
          const x = 14 + (index * 37) % Math.max(width - 28, 1);
          const y = 12 + (index * 23) % Math.max(height - 24, 1);
          context.beginPath(); context.moveTo(x, y); context.lineTo(x + 22 + index % 4 * 7, y + (index % 2 ? 9 : -9)); context.stroke();
          if (index % 3 === 0) { context.beginPath(); context.arc(x, y, 2.2, 0, Math.PI * 2); context.fillStyle = '#171717'; context.fill(); }
        }
      }
      if (animate && !reduced) frame = requestAnimationFrame(draw);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [variant, animate]);
  return <canvas ref={canvasRef} className={`plate-canvas ${className}`} aria-hidden="true" />;
}

function CardPlate({ category, index }) {
  return <div className={`rail-plate plate-${categorySlug(category)}`}><PlateCanvas variant={category === 'Electronics' ? 'electronics' : category === 'Mechanical' ? 'mechanical' : 'computer'} /><span className="plate-index" data-rev>PLATE / {String(index).padStart(2, '0')}</span></div>;
}

function progressFor(stage) {
  if (!stage) return 0;
  const range = Math.max(stage.offsetHeight - window.innerHeight, 1);
  return Math.max(0, Math.min(1, -stage.getBoundingClientRect().top / range));
}

function Home() {
  const [posts, setPosts] = useState([]);
  const [status, setStatus] = useState('loading');
  const [apiError, setApiError] = useState('');
  const [seasonPhase, setSeasonPhase] = useState(0);
  const seasonPhaseRef = React.useRef(0);
  useEffect(() => {
    const beganAt = performance.now();
    api('/api/posts').then((data) => {
      if (!Array.isArray(data)) throw new Error('The articles API returned an unexpected response.');
      const delay = Math.max(0, 480 - (performance.now() - beganAt));
      window.setTimeout(() => { setPosts(data); setStatus('ready'); }, delay);
    }).catch((error) => { setApiError(error.message); setStatus('error'); });
  }, []);
  useEffect(() => {
    let frame = 0;
    const root = document.documentElement;
    const write = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const heroProgress = progressFor(document.querySelector('[data-stage="hero"]'));
        const railProgress = progressFor(document.querySelector('[data-stage="rail"]'));
        const seasonProgress = progressFor(document.querySelector('[data-stage="season"]'));
        const posterTitle = document.querySelector('.poster-title');
        const posterKicker = document.querySelector('.poster-kicker');
        if (posterTitle && posterKicker) {
          const fitLine = (element, maxVw, charsPerEm, maxPx, property) => {
            let size = Math.min(window.innerWidth * maxVw, maxPx, window.innerWidth * 0.92 / (element.textContent.trim().length * charsPerEm));
            root.style.setProperty(property, `${size}px`);
            if (element.scrollWidth > element.clientWidth && element.clientWidth > 0) {
              size *= (element.clientWidth / element.scrollWidth) * 0.98;
              root.style.setProperty(property, `${size}px`);
            }
            element.dataset.fit = 'checked';
          };
          fitLine(posterTitle, 0.22, 0.44, 240, '--poster-title-size');
          fitLine(posterKicker, 0.012, 0.5, 24, '--poster-kicker-size');
        }
        root.style.setProperty('--hero-type-y', `${-90 * heroProgress}px`);
        root.style.setProperty('--hero-type-scale', String(1 - 0.26 * heroProgress));
        root.style.setProperty('--hero-type-alpha', String(1 - heroProgress));
        root.style.setProperty('--hero-meta-alpha', String(1 - heroProgress));
        const track = document.querySelector('.rail-track');
        const overflow = track ? Math.max(0, track.scrollWidth - window.innerWidth) : 0;
        root.style.setProperty('--rail-x', `${-railProgress * overflow}px`);
        root.style.setProperty('--rail-meter', `${railProgress * 100}%`);
        root.style.setProperty('--season-y', `${-4 + 8 * seasonProgress}%`);
        root.style.setProperty('--season-scale', String(1.1 - 0.045 * seasonProgress));
        const nextSeasonPhase = Math.min(2, Math.floor(seasonProgress * 3));
        if (seasonPhaseRef.current !== nextSeasonPhase) { seasonPhaseRef.current = nextSeasonPhase; setSeasonPhase(nextSeasonPhase); }
      });
    };
    window.addEventListener('scroll', write, { passive: true });
    window.addEventListener('resize', write);
    write();
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', write); window.removeEventListener('resize', write); };
  }, [status]);
  useEffect(() => {
    const items = document.querySelectorAll('[data-rev]');
    if (!('IntersectionObserver' in window)) { items.forEach((item) => item.classList.add('is-revealed')); return; }
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('is-revealed'); observer.unobserve(entry.target); }
    }), { threshold: 0.12 });
    items.forEach((item, index) => { item.style.setProperty('--d', `${Math.min(index % 8, 6) * 48}ms`); observer.observe(item); });
    return () => observer.disconnect();
  }, [status, posts.length]);
  if (status === 'loading') return <LoadingState message="Loading the field notes" />;

  const highlightedPosts = posts.filter((post) => post.published && post.featured).slice(0, 6);
  return <><PublicHeader /><main className="choreo-home">
    <section className="pin-stage hero-stage" data-stage="hero"><div className="pin-inner hero-pin"><PlateCanvas variant="soil" className="hero-soil" animate /><div className="poster-lockup"><WordLine as="p" className="poster-kicker">Ideas for the curious engineer.</WordLine><WordLine as="h1" className="poster-title">AUV BLOG</WordLine><p className="poster-lede" data-rev>The systems we build shape the world we live in. Explore the thinking behind them — one good read at a time.</p></div><div className="poster-meta"><span data-rev>COMPUTER SCIENCE</span><span data-rev>ELECTRONICS</span><span data-rev>MECHANICAL</span><span className="poster-scroll" data-rev>SCROLL TO EXPLORE&nbsp; ↓</span></div><div className="poster-counter">01 <i>/ 03</i></div></div></section>

    <section className="pin-stage rail-stage" data-stage="rail" id="latest"><div className="pin-inner rail-pin"><div className="rail-heading"><div><p className="eyebrow" data-rev>THE READING ROOM / 02</p><h2><WordLine>Selected field notes.</WordLine></h2></div><p className="rail-hint" data-rev>CURATED BY THE CLUB EDITOR&nbsp; ↘</p></div>{highlightedPosts.length ? <div className="rail-window"><div className="rail-track">{highlightedPosts.map((post, index) => <Link className="rail-card" key={post.id} to={`/${post.slug}/`} data-rev><CardPlate category={post.category} index={index + 1} /><div className="rail-card-meta" data-rev><span>{post.category}</span><span>READ / {Math.max(1, Math.ceil((post.markdown || '').split(/\s+/).length / 220))} MIN</span></div><h3 data-rev>{post.title}</h3><p data-rev>{post.excerpt}</p><span className="rail-card-link" data-rev>OPEN ARTICLE <b>↗</b></span></Link>)}</div></div> : <div className="reading-room-empty" data-rev><span>THE EDITOR’S SELECTION</span><p>Stories chosen for the Reading Room will appear here.</p></div>}<div className="rail-meter"><span /></div><div className="rail-footer"><span>{String(highlightedPosts.length).padStart(2, '0')} SELECTED / UP TO 06</span><span>COMPUTER SCIENCE · ELECTRONICS · MECHANICAL</span></div></div></section>

    <section className="pin-stage season-stage" data-stage="season" id="fields"><div className="pin-inner season-pin"><PlateCanvas variant="contour" className="season-contours" animate /><div className="season-top"><p className="eyebrow" data-rev>THREE WAYS TO LOOK CLOSER / 03</p><span data-rev>AN OPEN FIELD OF IDEAS</span></div><div className="season-content"><h2><WordLine>Follow your curiosity.</WordLine></h2><div className="season-chapters">{CATEGORIES.map((category, index) => <Link className={`season-chapter ${seasonPhase === index ? 'chapter-active' : ''}`} data-rev to={`/category/${categorySlug(category)}`} key={category} aria-current={seasonPhase === index ? 'step' : undefined}><span className="chapter-number" data-rev>0{index + 1} / FIELD</span><h3 data-rev>{category}</h3><p data-rev>{CATEGORY_COPY[category]}</p><span className="chapter-arrow" data-rev>OPEN SECTION&nbsp; ↗</span></Link>)}</div></div><div className="season-bottom"><span>COMPUTER SCIENCE / ELECTRONICS / MECHANICAL</span><span>CHOOSE A FIELD TO EXPLORE&nbsp; ↓</span></div><div className="season-index">03 <i>/ 03</i></div></div></section>

    {status === 'error' && <section className="archive-band section-wrap"><p className="empty-category">Articles could not be loaded: {apiError}</p></section>}

    <section className="faq-band section-wrap"><div className="faq-heading" data-rev><p className="eyebrow">A FEW GOOD QUESTIONS</p><h2><WordLine>Before you dive in.</WordLine></h2></div><div className="faq-list"><details data-rev><summary data-rev>What is the AUV-ZHCET blog?</summary><p>The club journal of MTS AUV-ZHCET, sharing ideas and field notes from autonomous underwater vehicle work across computer science, electronics, and mechanical engineering.</p></details><details data-rev><summary data-rev>How are articles made?</summary><p>Each article starts with source material, then gets reviewed and shaped into a clear field note before it is published.</p></details><details data-rev><summary data-rev>Can I explore just one discipline?</summary><p>Yes. Choose Computer Science, Electronics, or Mechanical and follow that field through the archive.</p></details></div></section>

    </main><Footer /></>;
}

function categorySlug(category) { return category.toLowerCase().replaceAll(' ', '-'); }

function ArticlePage() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [state, setState] = useState('loading');
  useEffect(() => {
    setState('loading');
    api(`/api/posts/${encodeURIComponent(slug)}`).then((data) => { setPost(data); setState('ready'); }).catch(() => setState('error'));
  }, [slug]);
  if (state === 'loading') return <LoadingState message="Loading the article" />;
  if (state === 'error') return <><PublicHeader /><main className="not-found"><p className="eyebrow">ARTICLE NOT FOUND</p><h1>This page isn’t here.</h1><Link className="button-primary" to="/">Back to the club blog <span>↗</span></Link></main><Footer /></>;
  const date = new Date(post.createdAt).toLocaleDateString('en', { year: 'numeric', month: 'short', day: '2-digit' });
  return <><PublicHeader /><main className="article-page"><Link className="back-link" to={`/category/${categorySlug(post.category)}`}>← Back to {post.category}</Link><header className="post-hero"><div className="article-meta"><span className="tag">{post.category.toUpperCase()}</span><span>ARTICLE</span><span>·</span><span>{date}</span></div><h1>{post.title}</h1><p className="post-deck">{post.excerpt}</p><div className="post-author"><Avatar author={post.author} /><div className="author-info"><span>{post.author}</span><span>{post.category} contributor</span></div></div></header><div className={`post-banner ${post.category === 'Electronics' ? 'banner-ee' : post.category === 'Mechanical' ? 'banner-me' : 'banner-cs'}`}><div className="banner-graphic">{post.category === 'Electronics' ? 'VCC · GND' : post.category === 'Mechanical' ? 'σ = F / A' : 'f(x) → y'}</div></div><article className="post-body"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{post.markdown}</ReactMarkdown></article><div className="post-footer"><span>END OF ARTICLE</span><Link to="/#latest">More from MTS AUV-ZHCET ↗</Link></div></main><Footer /></>;
}

function CategoryPage() {
  const { categorySlug: requestedCategory } = useParams();
  const category = CATEGORIES.find((item) => categorySlug(item) === requestedCategory);
  const [posts, setPosts] = useState([]);
  const [state, setState] = useState('loading');
  useEffect(() => {
    api('/api/posts').then((data) => { setPosts(data); setState('ready'); }).catch(() => setState('error'));
  }, []);
  if (!category) return <><PublicHeader /><main className="not-found"><p className="eyebrow">FIELD NOT FOUND</p><h1>This section isn’t here.</h1><Link className="button-primary" to="/#fields">Explore all fields <span>↗</span></Link></main><Footer /></>;
  const articles = posts.filter((post) => post.category === category);
  return <><PublicHeader /><main className="directory-page"><div className="directory-kicker"><Link to="/#fields">ALL FIELDS</Link><span> / {CATEGORY_SHORT[category]}</span></div><header className="directory-heading"><p className="eyebrow">MTS AUV-ZHCET / FIELD {String(CATEGORIES.indexOf(category) + 1).padStart(2, '0')}</p><h1>{category}</h1><p>{CATEGORY_COPY[category]}</p></header>{state === 'loading' ? <p className="directory-state">Loading articles…</p> : state === 'error' ? <p className="directory-state">Articles could not be loaded. Please refresh the page.</p> : articles.length ? <div className="blog-card-grid">{articles.map((post, index) => <BlogCard post={post} index={index + 1} key={post.id} />)}</div> : <div className="directory-empty"><span>NO FIELD NOTES YET</span><p>New writing for this section is on its way.</p></div>}</main><Footer /></>;
}

function AboutPage() {
  return <><PublicHeader /><main className="about-page"><div className="about-page-hero"><p className="eyebrow">MTS AUV-ZHCET / ZHCET · AMU</p><h1>Curiosity is an engineering tool.</h1><p>A journal from the people building autonomous underwater vehicles at Aligarh Muslim University.</p><div className="about-page-mark" aria-hidden="true">AUV<br /><span>FIELD NOTES</span></div></div><section className="about-page-copy"><p className="eyebrow">ABOUT THE CLUB</p><h2>We learn by building.</h2><p>MTS AUV-ZHCET is a student engineering club at Zakir Husain College of Engineering and Technology, Aligarh Muslim University. We design and build autonomous underwater vehicles, bringing software, electronics, and mechanical engineering together to solve real problems.</p><p>This reading room shares what we discover along the way: the concepts behind our systems, the experiments that teach us, and the ideas that help the next builder go further.</p></section><section className="about-fields"><p className="eyebrow">THREE FIELDS / ONE TEAM</p><div>{CATEGORIES.map((category, index) => <Link to={`/category/${categorySlug(category)}`} key={category}><span>0{index + 1} / FIELD</span><strong>{category}</strong><b>EXPLORE ↗</b></Link>)}</div></section><div className="about-page-end"><span>BUILT AT ZHCET · AMU</span><Link to="/#latest">Enter the Reading Room ↗</Link></div></main><Footer /></>;
}

function AdminFrame({ children }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  async function logout() {
    try { await auth.signOut(); navigate('/admin/login'); } catch (problem) { setError(problem.message); }
  }
  return <><header className="admin-top"><Brand /><span>PRIVATE EDITOR</span><button className="admin-quiet" onClick={logout}>Sign out</button></header>{error && <div className="flash flash-error admin-toast">{error}</div>}{children}</>;
}

function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!auth.loading && auth.admin) navigate('/admin', { replace: true }); }, [auth.loading, auth.admin, navigate]);
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try { await auth.signIn(username, password); navigate('/admin', { replace: true }); }
    catch (problem) { setError(problem.message); }
    finally { setBusy(false); }
  }
  return <main className="admin-shell login-shell"><Brand /><p className="eyebrow">PRIVATE EDITOR ACCESS</p><h1>Sign in.</h1><p className="admin-subtitle">This area is for the site administrator.</p>{error && <div className="flash flash-error">{error}</div>}<form className="admin-form" onSubmit={submit}><label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" autoFocus required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label><button className="admin-button" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></form><Link className="admin-back" to="/">← Return to the club blog</Link></main>;
}

function useRequireAdmin() {
  const auth = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!auth.loading && !auth.admin) navigate('/admin/login', { replace: true }); }, [auth.loading, auth.admin, navigate]);
  return auth;
}

function AdminDashboard() {
  const auth = useRequireAdmin();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [author, setAuthor] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  async function refresh() {
    const data = await api('/api/posts/admin/all');
    setPosts(data);
  }
  useEffect(() => { if (auth.admin) refresh().catch((problem) => setError(problem.message)).finally(() => setLoading(false)); }, [auth.admin]);
  async function upload(event) {
    event.preventDefault(); setError(''); setBusy(true);
    const body = new FormData(); body.append('title', title); body.append('category', category); body.append('author', author || 'MTS AUV-ZHCET'); body.append('pdf', file);
    try {
      const post = await api('/api/posts/admin/upload', { method: 'POST', headers: { 'X-CSRF-Token': auth.csrfToken }, body });
      navigate(`/admin/posts/${post.id}/edit`);
    } catch (problem) { setError(problem.message); }
    finally { setBusy(false); }
  }
  async function visibility(post) {
    setError('');
    try { await api(`/api/posts/admin/${post.id}`, { method: 'PATCH', headers: { 'X-CSRF-Token': auth.csrfToken }, body: JSON.stringify({ published: !post.published }) }); await refresh(); }
    catch (problem) { setError(problem.message); }
  }
  async function featured(post) {
    setError('');
    try { await api(`/api/posts/admin/${post.id}`, { method: 'PATCH', headers: { 'X-CSRF-Token': auth.csrfToken }, body: JSON.stringify({ featured: !post.featured }) }); await refresh(); }
    catch (problem) { setError(problem.message); }
  }
  async function remove(post) {
    if (!window.confirm(`Delete “${post.title}” permanently?`)) return;
    setError('');
    try { await api(`/api/posts/admin/${post.id}`, { method: 'DELETE', headers: { 'X-CSRF-Token': auth.csrfToken } }); await refresh(); }
    catch (problem) { setError(problem.message); }
  }
  if (auth.loading || !auth.admin) return <p className="admin-loading">Checking your private session…</p>;
  return <AdminFrame><main className="admin-shell"><p className="eyebrow">CONTENT STUDIO</p><h1>Your blog.</h1><p className="admin-subtitle">Upload a PDF to convert its text, tables, and embedded images to Markdown, then review and publish it.</p>{error && <div className="flash flash-error">{error}</div>}<section className="admin-panel"><h2>New article from PDF</h2><form className="admin-form upload-form" onSubmit={upload}><label>Article title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength="180" required placeholder="A clear, interesting title" /></label><div className="form-pair"><label>Section<select value={category} onChange={(event) => setCategory(event.target.value)} required><option value="">Choose a section</option>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label><label>Author<input value={author} onChange={(event) => setAuthor(event.target.value)} maxLength="100" placeholder="MTS AUV-ZHCET" /></label></div><label className="file-label">PDF file<input type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} required /><small>PDFs up to 4 MB. Embedded figures and detected tables are included. Scanned-only PDFs need OCR first.</small></label><button className="admin-button" disabled={busy}>{busy ? 'Converting PDF…' : 'Convert PDF & continue to review ↗'}</button></form></section><section className="admin-posts"><div className="admin-list-heading"><h2>Articles</h2><span>{posts.length} total · featured posts appear in the Reading Room</span></div>{loading ? <p className="admin-empty">Loading articles…</p> : posts.length ? posts.map((post) => <article className="admin-post" key={post.id}><div><span className="tag">{post.category.toUpperCase()}</span><h3 data-rev>{post.title}</h3><span className="admin-post-url">/{post.slug}/ · {post.published ? 'Published' : 'Draft'} · {post.featured ? 'Reading Room selection' : 'Not highlighted'}</span></div><div className="admin-actions"><Link to={`/admin/posts/${post.id}/edit`}>Edit</Link><button onClick={() => featured(post)}>{post.featured ? 'Remove highlight' : 'Highlight'}</button><button onClick={() => visibility(post)}>{post.published ? 'Unpublish' : 'Publish'}</button><button className="delete-action" onClick={() => remove(post)}>Delete</button></div></article>) : <p className="admin-empty">Your articles will appear here after you upload a PDF.</p>}</section></main></AdminFrame>;
}

function EditPost() {
  const auth = useRequireAdmin();
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [author, setAuthor] = useState('');
  const [markdown, setMarkdown] = useState('');
  const markdownInput = React.useRef(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!auth.admin) return;
    api('/api/posts/admin/all').then((posts) => {
      const found = posts.find((item) => item.id === id);
      if (!found) throw new Error('Article not found.');
      setPost(found); setTitle(found.title); setCategory(found.category); setAuthor(found.author); setMarkdown(found.markdown);
    }).catch((problem) => setError(problem.message));
  }, [auth.admin, id]);
  async function save(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      await api(`/api/posts/admin/${id}`, { method: 'PATCH', headers: { 'X-CSRF-Token': auth.csrfToken }, body: JSON.stringify({ title, category, author, markdown, published: true }) });
      navigate('/admin', { state: { notice: 'Article saved and published.' } });
    } catch (problem) { setError(problem.message); }
    finally { setBusy(false); }
  }
  async function uploadImage(event) {
    const image = event.target.files?.[0];
    if (!image) return;
    setError(''); setImageBusy(true);
    const body = new FormData(); body.append('image', image);
    try {
      const uploaded = await api(`/api/posts/admin/${id}/images`, { method: 'POST', headers: { 'X-CSRF-Token': auth.csrfToken }, body });
      const alt = image.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Article image';
      const insertion = `![${alt}](${uploaded.url})`;
      const input = markdownInput.current;
      const start = input?.selectionStart ?? markdown.length;
      const end = input?.selectionEnd ?? markdown.length;
      const before = markdown.slice(0, start);
      const after = markdown.slice(end);
      const separator = before && !before.endsWith('\n') ? '\n\n' : '';
      const nextMarkdown = `${before}${separator}${insertion}\n\n${after}`;
      setMarkdown(nextMarkdown);
      requestAnimationFrame(() => {
        if (!input) return;
        input.focus();
        const cursor = before.length + separator.length + insertion.length + 2;
        input.setSelectionRange(cursor, cursor);
      });
    } catch (problem) { setError(problem.message); }
    finally { setImageBusy(false); event.target.value = ''; }
  }
  if (auth.loading || !auth.admin) return <p className="admin-loading">Checking your private session…</p>;
  return <AdminFrame><main className="admin-shell edit-shell"><p className="eyebrow">REVIEW YOUR CONVERSION</p><h1>Edit the article.</h1><p className="admin-subtitle">PDF text is now Markdown. Check the structure and make any changes before publishing.</p>{error && <div className="flash flash-error">{error}</div>}{!post ? <p className="admin-empty">Loading article…</p> : <form className="admin-form admin-panel" onSubmit={save}><label>Article title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength="180" required /></label><div className="form-pair"><label>Section<select value={category} onChange={(event) => setCategory(event.target.value)}>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label><label>Author<input value={author} onChange={(event) => setAuthor(event.target.value)} maxLength="100" /></label></div><label>Markdown content<textarea ref={markdownInput} value={markdown} onChange={(event) => setMarkdown(event.target.value)} rows="24" required spellCheck="true" /></label><label className="file-label">Add an article image<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={uploadImage} disabled={imageBusy} /><small>JPG, PNG, WebP, or GIF up to 4 MB. Upload inserts the Markdown image at the cursor position.</small></label><div className="edit-actions"><button className="admin-button" disabled={busy || imageBusy}>{busy ? 'Saving…' : imageBusy ? 'Uploading image…' : 'Save & publish article'}</button>{post.published && <Link to={`/${post.slug}/`} target="_blank" rel="noopener">View published page ↗</Link>}</div></form>}</main></AdminFrame>;
}

function App() {
  return <AuthProvider><BrowserRouter><Routes><Route path="/" element={<Home />} /><Route path="/about" element={<AboutPage />} /><Route path="/category/:categorySlug" element={<CategoryPage />} /><Route path="/admin/login" element={<LoginPage />} /><Route path="/admin" element={<AdminDashboard />} /><Route path="/admin/posts/:id/edit" element={<EditPost />} /><Route path="/:slug" element={<ArticlePage />} /><Route path="*" element={<ArticlePage />} /></Routes></BrowserRouter></AuthProvider>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
