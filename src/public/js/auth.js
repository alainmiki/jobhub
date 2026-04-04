document.addEventListener('DOMContentLoaded', () => {
    const authForms = document.querySelectorAll('form[data-auth-type]');

    authForms.forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const type = form.getAttribute('data-auth-type');
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            const errorDiv = form.querySelector('.error-message');

            if (data._gotcha) return; // Honeypot

            try {
                const response = await fetch(form.action, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': data._csrf || document.getElementById('globalCsrfToken')?.value
                    },
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (response.ok) {
                    if (type === 'forgot') {
                        if (errorDiv) errorDiv.innerHTML = '<span class="text-success">Reset link sent! Check your email.</span>';
                    } else {
                        window.location.href = data.redirect || '/';
                    }
                } else {
                    if (errorDiv) errorDiv.textContent = result.message || 'Authentication failed';
                }
            } catch (err) {
                console.error(err);
                if (errorDiv) errorDiv.textContent = 'A network error occurred.';
            }
        });
    });
});