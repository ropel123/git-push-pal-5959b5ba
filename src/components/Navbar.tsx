import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import hackifyLogo from '@/assets/hackify-logo.png';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled ? 'bg-background/90 backdrop-blur-lg border-b border-border/50' : 'bg-transparent'
    }`}>
      <div className="section-container">
        <nav className="flex items-center justify-between h-20">
          <a href="#" className="flex items-center">
            <img src={hackifyLogo} alt="Hackify" className="h-56 w-auto" />
          </a>

          <div className="hidden md:flex items-center gap-4">
            <a href="#contact" className="text-muted-foreground hover:text-foreground transition-colors font-medium">
              Contact
            </a>
            <button
              onClick={() => navigate('/auth')}
              className="text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              Se connecter
            </button>
            <button
              onClick={() => navigate('/auth')}
              className="btn-primary py-2.5 px-6 text-sm"
            >
              Essai gratuit
            </button>
          </div>

          <button
            className="md:hidden p-2 text-foreground"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </nav>

        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border/50">
            <div className="flex flex-col gap-4">
              <a href="#contact" className="text-muted-foreground hover:text-foreground transition-colors font-medium py-2" onClick={() => setIsMobileMenuOpen(false)}>
                Contact
              </a>
              <button onClick={() => { setIsMobileMenuOpen(false); navigate('/auth'); }} className="text-muted-foreground hover:text-foreground transition-colors font-medium py-2 text-left">
                Se connecter
              </button>
              <button onClick={() => { setIsMobileMenuOpen(false); navigate('/auth'); }} className="btn-primary py-2.5 px-6 text-sm text-center mt-2">
                Essai gratuit
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
