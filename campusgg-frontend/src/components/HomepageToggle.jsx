function HomepageToggle({ isOn, onToggle }) {
  return (
    <button className="toggle-row" type="button" role="switch" aria-checked={isOn} onClick={onToggle}>
      <span className={`toggle ${isOn ? 'toggle-on' : 'toggle-off'}`} aria-hidden="true">
        <span className="toggle-knob"></span>
      </span>
      <span className="toggle-label">Set Lobby as Homepage</span>
    </button>
  )
}

export default HomepageToggle
