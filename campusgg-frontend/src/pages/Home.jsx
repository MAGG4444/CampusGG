import { ArrowRight, Gamepad2, MessageSquareText, ShieldCheck, UsersRound, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import './Home.css'

const highlights = [
  { icon: UsersRound, title: 'Find your squad', text: 'Discover players by game, skill level, and the kind of session you want to play.' },
  { icon: MessageSquareText, title: 'Trade game knowledge', text: 'Join campus conversations about strategy, tournaments, team building, and the latest meta.' },
  { icon: ShieldCheck, title: 'Build your circle', text: 'Turn quick queues into reliable connections with players from your campus community.' },
]

function Home() {
  return (
    <div className="home-page page-enter">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <p className="page-kicker">Your campus. Your games. Your people.</p>
          <h1 id="home-title">Queue up with a campus community built to play.</h1>
          <p className="home-lede">CampusGG is the home base for finding teammates, joining focused lobbies, and sharing the conversations that make every game better.</p>
          <div className="home-actions">
            <Link className="home-primary-action" to="/lobby">Explore lobbies <ArrowRight size={18} aria-hidden="true" /></Link>
            <Link className="home-secondary-action" to="/forum">Visit the forum</Link>
          </div>
          <div className="home-signal-row" aria-label="CampusGG community highlights">
            <span><Zap size={15} aria-hidden="true" /> Real-time discovery</span>
            <span><Gamepad2 size={15} aria-hidden="true" /> All skill levels</span>
          </div>
        </div>

        <div className="home-arena" aria-hidden="true">
          <div className="arena-orbit arena-orbit-outer" />
          <div className="arena-orbit arena-orbit-inner" />
          <div className="arena-core">
            <Gamepad2 size={54} strokeWidth={1.5} />
            <strong>CampusGG</strong>
            <span>Find your next team</span>
          </div>
          <span className="arena-node arena-node-one" />
          <span className="arena-node arena-node-two" />
          <span className="arena-node arena-node-three" />
        </div>
      </section>

      <section className="home-highlights" aria-labelledby="community-heading">
        <div className="home-section-heading">
          <p className="page-kicker">One community, every session</p>
          <h2 id="community-heading">Everything you need to get in the game</h2>
        </div>
        <div className="home-highlight-grid">
          {highlights.map(({ icon: Icon, title, text }) => (
            <article className="home-highlight-card" key={title}>
              <span className="highlight-icon"><Icon size={22} aria-hidden="true" /></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

export default Home
