const header = document.querySelector('.site-header');
const menuButton = document.querySelector('.mobile-menu');
const mobileNavigation = document.getElementById('mobile-navigation');

if (header && menuButton && mobileNavigation) {
  const closeMenu = ({ restoreFocus = false } = {}) => {
    mobileNavigation.hidden = true;
    menuButton.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open navigation');
    if (restoreFocus) menuButton.focus();
  };

  const openMenu = () => {
    mobileNavigation.hidden = false;
    menuButton.classList.add('is-open');
    menuButton.setAttribute('aria-expanded', 'true');
    menuButton.setAttribute('aria-label', 'Close navigation');
  };

  menuButton.addEventListener('click', () => {
    if (mobileNavigation.hidden) openMenu();
    else closeMenu();
  });

  mobileNavigation.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeMenu();
  });

  document.addEventListener('click', (event) => {
    if (!mobileNavigation.hidden && !header.contains(event.target)) closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !mobileNavigation.hidden) closeMenu({ restoreFocus: true });
  });

  const desktopQuery = window.matchMedia('(min-width: 621px)');
  const handleDesktopChange = (event) => {
    if (event.matches) closeMenu();
  };
  desktopQuery.addEventListener('change', handleDesktopChange);
}
