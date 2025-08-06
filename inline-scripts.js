// Extracted inline scripts from index.html for better performance
document.addEventListener('DOMContentLoaded', function() {
    // Instructions Modal Functionality
    const instructionsModal = document.getElementById('instructions-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const gotItBtn = document.getElementById('got-it-btn');

    function showModal() {
        instructionsModal.classList.add('active');
        document.body.classList.add('modal-open');
        document.body.style.overflow = 'hidden';
    }

    function hideModal() {
        instructionsModal.classList.remove('active');
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
    }

    // Event listeners
    if (closeModalBtn) closeModalBtn.addEventListener('click', hideModal);
    if (gotItBtn) gotItBtn.addEventListener('click', hideModal);
    
    // Close on outside click
    if (instructionsModal) {
        instructionsModal.addEventListener('click', (e) => {
            if (e.target === instructionsModal) hideModal();
        });
    }
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && instructionsModal && instructionsModal.classList.contains('active')) {
            hideModal();
        }
    });

    // Show modal immediately
    showModal();
});