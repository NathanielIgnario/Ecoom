document.addEventListener('DOMContentLoaded', () => {

    // 1. Sticky Header
    const header = document.querySelector('.header');
    if (header) {
        window.addEventListener('scroll', () => {
            header.classList.toggle('scrolled', window.scrollY > 60);
        });
    }

    // 2. Mobile menu toggle
    const mobileBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');
    if (mobileBtn && navLinks) {
        const updateMenuState = () => {
            const isOpen = navLinks.classList.contains('active');
            mobileBtn.setAttribute('aria-expanded', String(isOpen));
            mobileBtn.classList.toggle('active', isOpen);
        };

        mobileBtn.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                navLinks.classList.toggle('active');
                updateMenuState();
            }
        });

        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                updateMenuState();
            });
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                navLinks.classList.remove('active');
                updateMenuState();
            }
        });

        updateMenuState();
    }

    // 3. Testimonial Slider
    const track = document.querySelector('.testi-track');
    const dots = document.querySelectorAll('.testi-dot');
    let currentTesti = 0;
    let testiInterval;

    function showTesti(index) {
        if (!track) return;
        const slides = track.querySelectorAll('.testi-slide');
        currentTesti = (index + slides.length) % slides.length;
        track.style.transform = `translateX(-${currentTesti * 100}%)`;
        dots.forEach((d, i) => d.classList.toggle('active', i === currentTesti));
    }

    function startTesti() {
        stopTesti();
        testiInterval = setInterval(() => showTesti(currentTesti + 1), 5000);
    }
    function stopTesti() { clearInterval(testiInterval); }

    if (track) {
        showTesti(0);
        startTesti();
        dots.forEach((dot, i) => dot.addEventListener('click', () => { showTesti(i); startTesti(); }));
    }

    // 4. Wishlist toggle
    document.querySelectorAll('.wishlist-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            btn.classList.toggle('active');
        });
    });

    // 5. Cart counter simulation
    const cartCount = document.querySelector('.cart-count');
    let cartQty = parseInt(localStorage.getItem('goarcana_cart') || '0');
    if (cartCount) cartCount.textContent = cartQty;

    document.querySelectorAll('.product-quick-add, .add-to-cart-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            cartQty++;
            localStorage.setItem('goarcana_cart', cartQty);
            if (cartCount) {
                cartCount.textContent = cartQty;
                cartCount.style.transform = 'scale(1.5)';
                setTimeout(() => cartCount.style.transform = 'scale(1)', 300);
            }
        });
    });

    // 6. Newsletter form
    const newsletterForm = document.querySelector('.newsletter-form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = newsletterForm.querySelector('input[type=email]');
            if (email && email.value) {
                const subs = JSON.parse(localStorage.getItem('goarcana_subs') || '[]');
                subs.push({ email: email.value, date: new Date().toISOString() });
                localStorage.setItem('goarcana_subs', JSON.stringify(subs));
                alert('Thank you for subscribing! Exclusive deals are on their way.');
                email.value = '';
            }
        });
    }

    // 7. Coupon code copy
    const couponCopy = document.querySelector('.coupon-copy');
    const couponCode = document.querySelector('.coupon-code');
    if (couponCopy && couponCode) {
        couponCopy.addEventListener('click', () => {
            navigator.clipboard.writeText(couponCode.textContent.trim()).then(() => {
                couponCopy.textContent = 'Copied!';
                setTimeout(() => couponCopy.textContent = 'Copy', 2000);
            }).catch(() => {
                alert('Code: ' + couponCode.textContent.trim());
            });
        });
    }

    // 8. FAQ Accordion (for contact page)
    document.querySelectorAll('.faq-header').forEach(header => {
        header.addEventListener('click', () => {
            const item = header.parentElement;
            const content = item.querySelector('.faq-content');
            const icon = header.querySelector('.faq-icon');
            const isOpen = item.classList.contains('active');

            document.querySelectorAll('.faq-item').forEach(i => {
                i.classList.remove('active');
                const c = i.querySelector('.faq-content');
                const ic = i.querySelector('.faq-icon');
                if (c) c.style.maxHeight = null;
                if (ic) ic.textContent = '+';
            });

            if (!isOpen) {
                item.classList.add('active');
                if (content) content.style.maxHeight = content.scrollHeight + 'px';
                if (icon) icon.textContent = '−';
            }
        });
    });

    // 9. Size selector (product detail)
    document.querySelectorAll('.size-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const group = btn.closest('.size-group');
            if (group) group.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // 10. Contact form
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(contactForm));
            const msgs = JSON.parse(localStorage.getItem('goarcana_msgs') || '[]');
            msgs.push({ ...data, ts: new Date().toISOString() });
            localStorage.setItem('goarcana_msgs', JSON.stringify(msgs));
            alert('Your message has been sent! We respond within 24 hours.');
            contactForm.reset();
        });
    }
});
