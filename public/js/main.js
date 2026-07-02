/* =====================================================
   Smart Computer Training — Main Public JS
   ===================================================== */

document.addEventListener('DOMContentLoaded', () => {

  // ── Navbar scroll effect ──────────────────────────
  const navbar = document.querySelector('.navbar-main');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) navbar?.classList.add('scrolled');
    else navbar?.classList.remove('scrolled');
  });

  // ── Hero Slider ───────────────────────────────────
  const slides = document.querySelectorAll('.hero-slide');
  const dots   = document.querySelectorAll('.slider-dot');
  let current  = 0;
  let autoplay;

  function goTo(index) {
    slides.forEach((s, i) => {
      s.style.display = i === index ? 'flex' : 'none';
      dots[i]?.classList.toggle('active', i === index);
    });
    current = index;
  }

  function next() { goTo((current + 1) % slides.length); }
  function prev() { goTo((current - 1 + slides.length) % slides.length); }

  if (slides.length > 0) {
    goTo(0);
    autoplay = setInterval(next, 5000);
    document.querySelector('.slider-arrow.next')?.addEventListener('click', () => { clearInterval(autoplay); next(); autoplay = setInterval(next, 5000); });
    document.querySelector('.slider-arrow.prev')?.addEventListener('click', () => { clearInterval(autoplay); prev(); autoplay = setInterval(next, 5000); });
    dots.forEach((dot, i) => dot.addEventListener('click', () => { clearInterval(autoplay); goTo(i); autoplay = setInterval(next, 5000); }));
  }

  // ── Counter Animation ─────────────────────────────
  function animateCounters() {
    document.querySelectorAll('.counter-number[data-target]').forEach(el => {
      const target = parseInt(el.dataset.target);
      let current  = 0;
      const step   = Math.ceil(target / 60);
      const timer  = setInterval(() => {
        current += step;
        if (current >= target) { current = target; clearInterval(timer); }
        el.textContent = current.toLocaleString('bn-BD');
      }, 25);
    });
  }

  const countersSection = document.querySelector('.counters-section');
  if (countersSection) {
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) { animateCounters(); obs.disconnect(); }
    }, { threshold: 0.3 });
    obs.observe(countersSection);
  }

  // ── Gallery Lightbox ──────────────────────────────
  const lightbox    = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');

  document.querySelectorAll('.gallery-item[data-src]').forEach(item => {
    item.addEventListener('click', () => {
      if (lightbox && lightboxImg) {
        lightboxImg.src = item.dataset.src;
        lightbox.classList.add('open');
        document.body.style.overflow = 'hidden';
      }
    });
  });

  document.getElementById('lightboxClose')?.addEventListener('click', closeLightbox);
  lightbox?.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
  function closeLightbox() {
    lightbox?.classList.remove('open');
    document.body.style.overflow = '';
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

  // ── Result Search ─────────────────────────────────
  const resultForm    = document.getElementById('resultSearchForm');
  const resultBox     = document.getElementById('resultBox');
  const resultSpinner = document.getElementById('resultSpinner');
  const resultError   = document.getElementById('resultError');

  resultForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const regNo = document.getElementById('regNoInput').value.trim();
    if (!regNo) return;

    resultBox?.classList.add('d-none');
    resultError?.classList.add('d-none');
    if (resultSpinner) resultSpinner.style.display = 'block';

    try {
      const res  = await fetch(`/api/result/${encodeURIComponent(regNo)}`);
      const data = await res.json();
      if (resultSpinner) resultSpinner.style.display = 'none';

      if (data.success) {
        renderMarksheet(data.result);
        resultBox?.classList.remove('d-none');
      } else {
        if (resultError) { resultError.textContent = data.message; resultError.classList.remove('d-none'); }
      }
    } catch {
      if (resultSpinner) resultSpinner.style.display = 'none';
      if (resultError) { resultError.textContent = 'সংযোগ ত্রুটি। পুনরায় চেষ্টা করুন।'; resultError.classList.remove('d-none'); }
    }
  });

  function renderMarksheet(r) {
    document.getElementById('ms-name').textContent    = r.studentName || '—';
    document.getElementById('ms-regno').textContent   = r.regNo       || '—';
    document.getElementById('ms-course').textContent  = r.courseName  || '—';
    document.getElementById('ms-session').textContent = r.session     || '—';
    document.getElementById('ms-father').textContent  = r.fatherName  || '—';

    // Pass/Fail Banner Logic
    const bannerContainer = document.getElementById('pfBannerContainer');
    const bannerIcon = document.getElementById('pfBannerIcon');
    const bannerTitle = document.getElementById('pfBannerTitle');
    const bannerText = document.getElementById('pfBannerText');
    
    bannerContainer.style.display = 'block';
    
    if (r.isPassed === true) {
      bannerContainer.style.background = 'rgba(16, 185, 129, 0.1)';
      bannerContainer.style.border = '1px solid #10B981';
      bannerIcon.className = 'bi bi-patch-check-fill';
      bannerIcon.style.color = '#10B981';
      bannerTitle.textContent = 'অভিনন্দন! আপনি উত্তীর্ণ হয়েছেন।';
      bannerTitle.style.color = '#065F46';
      bannerText.textContent = r.certificateUrl 
        ? 'আপনার সার্টিফিকেট নিচে দেওয়া হলো। আপনি চাইলে এটি প্রিন্ট বা ডাউনলোড করতে পারেন।' 
        : 'আপনার রেজাল্ট সফলভাবে প্রকাশিত হয়েছে।';
      bannerText.style.color = '#047857';
    } else {
      bannerContainer.style.background = 'rgba(239, 68, 68, 0.1)';
      bannerContainer.style.border = '1px solid #EF4444';
      bannerIcon.className = 'bi bi-x-circle-fill';
      bannerIcon.style.color = '#EF4444';
      bannerTitle.textContent = 'দুঃখিত! আপনি উত্তীর্ণ হতে পারেননি।';
      bannerTitle.style.color = '#991B1B';
      bannerText.textContent = 'আপনার রেজাল্ট অকৃতকার্য এসেছে। অনুগ্রহ করে প্রতিষ্ঠান কর্তৃপক্ষের সাথে যোগাযোগ করুন।';
      bannerText.style.color = '#7F1D1D';
    }

    // Certificate Preview Logic
    const certContainer = document.getElementById('certificateContainer');
    if (r.certificateUrl) {
      certContainer.style.display = 'block';
      const iframe = document.getElementById('pdfPreviewIframe');
      if (iframe) iframe.src = r.certificateUrl + '#toolbar=0'; // #toolbar=0 hides default PDF tools
      
      const btnDownload = document.getElementById('btnDownloadCert');
      if (btnDownload) {
        btnDownload.href = r.certificateUrl;
      }
    } else {
      certContainer.style.display = 'none';
    }
  }

  // ── Print result ──────────────────────────────────
  document.getElementById('btnPrint')?.addEventListener('click', () => window.print());

  // ── Contact Form ──────────────────────────────────
  const contactForm = document.getElementById('contactForm');
  contactForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn  = contactForm.querySelector('.btn-submit');
    btn.disabled = true;
    btn.textContent = 'পাঠানো হচ্ছে...';
    try {
      const fd  = new FormData(contactForm);
      const res = await fetch('/api/contact', { method: 'POST', body: new URLSearchParams(fd) });
      const data = await res.json();
      showPublicAlert(data.message, data.success ? 'success' : 'error');
      if (data.success) contactForm.reset();
    } catch { showPublicAlert('ত্রুটি হয়েছে। পুনরায় চেষ্টা করুন।', 'error'); }
    btn.disabled = false;
    btn.textContent = 'বার্তা পাঠান';
  });

  // ── Admission Form ────────────────────────────────
  const admissionForm = document.getElementById('admissionForm');
  admissionForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = admissionForm.querySelector('.btn-submit');
    btn.disabled = true;
    btn.textContent = 'আবেদন করা হচ্ছে...';
    try {
      const fd  = new FormData(admissionForm);
      const res = await fetch('/api/admission', { method: 'POST', body: new URLSearchParams(fd) });
      const data = await res.json();
      showPublicAlert(data.message, data.success ? 'success' : 'error');
      if (data.success) admissionForm.reset();
    } catch { showPublicAlert('ত্রুটি হয়েছে।', 'error'); }
    btn.disabled = false;
    btn.textContent = 'আবেদন জমা দিন';
  });

  function showPublicAlert(msg, type) {
    const div = document.createElement('div');
    div.className = `alert-custom alert-${type}-custom`;
    div.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${msg}`;
    document.querySelector('.alert-placeholder')?.prepend(div);
    setTimeout(() => div.remove(), 5000);
  }

  // ── Add contact API route on public routes ────────
  // (Handled via fetch to /api/contact — see route below)

  // ── AOS-like scroll reveal (lightweight) ─────────
  const reveals = document.querySelectorAll('.reveal');
  const revealObs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('revealed'); });
  }, { threshold: 0.1 });
  reveals.forEach(el => revealObs.observe(el));
});
