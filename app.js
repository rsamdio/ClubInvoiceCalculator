// Performance optimization: Use requestIdleCallback for non-critical operations
const requestIdleCallback = window.requestIdleCallback || ((cb) => setTimeout(cb, 1));

// Performance optimization: Debounce function for better performance
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Performance optimization: Throttle function for scroll/resize events
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Global variables
let parsedMembers = [];
let lastSelectedClubBase = '';
let lastSelectedJoinDate = '';
let currentPage = 1;
let pageSize = 10;
let allMemberRows = [];
let currentErrorTimeout = null;

// Initialize form validator
class FormValidator {
    constructor() {
        this.errors = new Map();
        this.validationRules = {
            'member-name': [
                { test: (value) => value.trim().length > 0, message: 'Member name is required' },
                { test: (value) => value.trim().length >= 2, message: 'Name must be at least 2 characters' },
                { test: (value) => /^[a-zA-Z\s]+$/.test(value.trim()), message: 'Name should only contain letters and spaces' }
            ],
            'member-type': [
                { test: (value) => value.length > 0, message: 'Please select a Club Base' }
            ],
            'join-date': [
                { test: (value) => value.length > 0, message: 'Join date is required' },
                { test: (value) => this.isValidDate(value), message: 'Please enter a valid date' }
            ],
            'leave-date': [
                { test: (value) => !value || this.isValidDate(value), message: 'Please enter a valid date' },
                { test: (value) => !value || this.isLeaveDateValid(value), message: 'Leave date cannot be before join date' }
            ]
        };
    }

    isValidDate(dateString) {
        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date);
    }

    isLeaveDateValid(leaveDate) {
        const joinDate = document.getElementById('join-date').value;
        if (!joinDate) return true;
        
        const leaveDateObj = new Date(leaveDate);
        const joinDateObj = new Date(joinDate);
        return leaveDateObj >= joinDateObj;
    }

    validateField(fieldId) {
        const field = document.getElementById(fieldId);
        if (!field || !this.validationRules[fieldId]) return true;

        const value = field.value;
        const rules = this.validationRules[fieldId];
        
        this.clearFieldError(fieldId);
        
        for (const rule of rules) {
            if (!rule.test(value)) {
                this.setFieldError(fieldId, rule.message);
                return false;
            }
        }
        
        this.setFieldSuccess(fieldId);
        return true;
    }

    validateAll() {
        this.clearAllErrors();
        
        let isValid = true;
        const fieldIds = Object.keys(this.validationRules);
        
        for (const fieldId of fieldIds) {
            if (!this.validateField(fieldId)) {
                isValid = false;
            }
        }
        
        return isValid;
    }

    setFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        const errorElement = document.getElementById(`${fieldId}-error`);
        
        if (field && errorElement) {
            field.classList.remove('input-success');
            field.classList.add('input-error');
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            this.errors.set(fieldId, message);
        }
    }

    setFieldSuccess(fieldId) {
        const field = document.getElementById(fieldId);
        const errorElement = document.getElementById(`${fieldId}-error`);
        
        if (field && errorElement) {
            field.classList.remove('input-error');
            field.classList.add('input-success');
            errorElement.style.display = 'none';
            errorElement.textContent = '';
            this.errors.delete(fieldId);
        }
    }

    clearFieldError(fieldId) {
        const field = document.getElementById(fieldId);
        const errorElement = document.getElementById(`${fieldId}-error`);
        
        if (field && errorElement) {
            field.classList.remove('input-error', 'input-success');
            errorElement.style.display = 'none';
            errorElement.textContent = '';
            this.errors.delete(fieldId);
        }
    }

    clearAllErrors() {
        document.querySelectorAll('.error-message').forEach(el => {
            el.style.display = 'none';
            el.textContent = '';
        });
        document.querySelectorAll('.input-error, .input-success').forEach(el => {
            el.classList.remove('input-error', 'input-success');
        });
        this.errors.clear();
    }

    getFirstError() {
        return this.errors.size > 0 ? this.errors.values().next().value : null;
    }

    hasErrors() {
        return this.errors.size > 0;
    }
}

const formValidator = new FormValidator();

// Utility functions - debounce already defined above

function preciseDecimal(value, decimals = 2) {
    return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

// Core calculation functions
function calculateIndividualDue(joinDateStr, clubBase, invoiceYear, leaveDateStr = null) {
    const joinDate = new Date(joinDateStr + 'T00:00:00');
    const invoiceDate = new Date(invoiceYear, 0, 1);
    const baseDues = clubBase === 'Community-Based' ? 8 : 5;
    const joinYear = joinDate.getFullYear();

    if (joinYear === invoiceYear - 1) {
        const joinMonth = joinDate.getMonth();
        const joinDay = joinDate.getDate();
        
        let effectiveJoinMonth = joinMonth;
        if (joinDay > 1) {
            effectiveJoinMonth += 1;
        }
        
        const monthsInJoinYear = Math.max(0, 12 - effectiveJoinMonth);
        let proratedDues = Math.round((baseDues / 12) * monthsInJoinYear * 100) / 100;

        if (leaveDateStr) {
            const leaveDate = new Date(leaveDateStr + 'T00:00:00');
            if (leaveDate < invoiceDate) {
                const leaveMonth = leaveDate.getMonth();
                const leaveDay = leaveDate.getDate();
                
                let effectiveLeaveMonth = leaveMonth;
                if (leaveDay > 1) {
                    effectiveLeaveMonth += 1;
                }
                
                if (effectiveLeaveMonth < effectiveJoinMonth) {
                    return { fullYear: 0, prorated: 0, total: 0, proratedMonths: 0 };
                }
                
                let actualMonthsInJoinYear = effectiveLeaveMonth - effectiveJoinMonth;
                actualMonthsInJoinYear = Math.max(0, actualMonthsInJoinYear);
                proratedDues = Math.round((baseDues / 12) * actualMonthsInJoinYear * 100) / 100;
                
                return { fullYear: 0, prorated: proratedDues, total: proratedDues, proratedMonths: actualMonthsInJoinYear };
            }
        }
        
        const total = Math.round((baseDues + proratedDues) * 100) / 100;
        return { fullYear: baseDues, prorated: proratedDues, total: total, proratedMonths: monthsInJoinYear };
    }

    if (leaveDateStr) {
        const leaveDate = new Date(leaveDateStr + 'T00:00:00');
        if (leaveDate < invoiceDate) return { fullYear: 0, prorated: 0, total: 0, proratedMonths: 0 };
    }

    if (joinYear < invoiceYear - 1) return { fullYear: baseDues, prorated: 0, total: baseDues, proratedMonths: 0 };
    return { fullYear: 0, prorated: 0, total: 0, proratedMonths: 0 };
}

function formatDuesBreakdown(duesBreakdown) {
    const { fullYear, prorated, total } = duesBreakdown;
    
    if (total === 0) {
        return '<span class="text-gray-400">$0.00</span>';
    }
    
    let breakdown = '';
    
    if (fullYear > 0 && prorated > 0) {
        breakdown = `$${preciseDecimal(fullYear).toFixed(2)} + $${preciseDecimal(prorated).toFixed(2)} = $${preciseDecimal(total).toFixed(2)}`;
    } else if (fullYear > 0) {
        breakdown = `$${preciseDecimal(fullYear).toFixed(2)} + $0.00 = $${preciseDecimal(total).toFixed(2)}`;
    } else if (prorated > 0) {
        breakdown = `$0.00 + $${preciseDecimal(prorated).toFixed(2)} = $${preciseDecimal(total).toFixed(2)}`;
    }
    
    return breakdown;
}

// UI update functions
function updateTotal() {
    requestIdleCallback(() => {
        let baseTotal = 0;
        let totalFullYear = 0;
        let totalProrated = 0;
        let totalMembersWithFullYear = 0;
        let totalProratedMonths = 0;
        
        const selectedYear = parseInt(document.getElementById('invoice-year-select').value, 10);
        const memberRows = document.getElementById('member-roster-body').querySelectorAll('tr');
        
        memberRows.forEach(row => {
            const joinDate = row.dataset.joinDate;
            const leaveDate = row.dataset.leaveDate;
            const memberType = row.dataset.memberType;
            const duesBreakdown = calculateIndividualDue(joinDate, memberType, selectedYear, leaveDate);
            
            baseTotal += duesBreakdown.total;
            totalFullYear += duesBreakdown.fullYear;
            totalProrated += duesBreakdown.prorated;
            
            if (duesBreakdown.fullYear > 0) {
                totalMembersWithFullYear++;
            }
            
            totalProratedMonths += duesBreakdown.proratedMonths || 0;
        });
        
        const taxPercentage = parseFloat(document.getElementById('tax-percentage').value) || 0;
        const taxAmount = Math.round((baseTotal * taxPercentage) / 100 * 100) / 100;
        const totalWithTax = Math.round((baseTotal + taxAmount) * 100) / 100;
        
        // Update display elements
        const baseInvoiceAmountEl = document.getElementById('base-invoice-amount');
        const totalInvoiceAmountEl = document.getElementById('total-invoice-amount');
        const taxBreakdownEl = document.getElementById('tax-breakdown');
        const duesBreakdownEl = document.getElementById('dues-breakdown');
        const totalMembersEl = document.getElementById('total-members');
        const totalProratedMonthsEl = document.getElementById('total-prorated-months');
        
        if (baseInvoiceAmountEl) baseInvoiceAmountEl.textContent = `$${Math.round(baseTotal * 100) / 100}`;
        if (totalInvoiceAmountEl) totalInvoiceAmountEl.textContent = `$${Math.round(totalWithTax * 100) / 100}`;
        if (taxBreakdownEl) taxBreakdownEl.textContent = `Tax: $${Math.round(taxAmount * 100) / 100} (${taxPercentage}%)`;
        
        if (duesBreakdownEl) {
            const preciseFullYear = Math.round(totalFullYear * 100) / 100;
            const preciseProrated = Math.round(totalProrated * 100) / 100;
            duesBreakdownEl.textContent = `Full Year: $${preciseFullYear.toFixed(2)} + Prorated: $${preciseProrated.toFixed(2)}`;
        }
        
        if (totalMembersEl) totalMembersEl.textContent = totalMembersWithFullYear;
        if (totalProratedMonthsEl) totalProratedMonthsEl.textContent = totalProratedMonths;
        
        // Show/hide empty state
        const emptyState = document.getElementById('empty-state');
        if (memberRows.length === 0) {
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
        }
    });
}

const debouncedUpdateTotal = debounce(updateTotal, 300);

function recalculateAllDues() {
    const selectedYear = parseInt(document.getElementById('invoice-year-select').value, 10);
    const memberRows = document.getElementById('member-roster-body').querySelectorAll('tr');
    
    memberRows.forEach(row => {
        if (row.classList.contains('editing')) return;
        
        const joinDate = row.dataset.joinDate;
        const leaveDate = row.dataset.leaveDate;
        const memberType = row.dataset.memberType;
        const duesBreakdown = calculateIndividualDue(joinDate, memberType, selectedYear, leaveDate);
        
        row.dataset.due = duesBreakdown.total;
        row.querySelector('.due-cell').innerHTML = formatDuesBreakdown(duesBreakdown);
        
        const cells = row.querySelectorAll('td');
        if (cells.length >= 7) {
            cells[5].textContent = duesBreakdown.fullYear > 0 ? 'Yes' : 'No';
            cells[6].textContent = duesBreakdown.proratedMonths || 0;
        }
    });
    
    updateTotal();
    updateInvoiceDateDisplay();
}

// Member management functions
function addMember(e) {
    if (!formValidator.validateAll()) {
        if (formValidator.errors.size > 1) {
            showErrorMessage(`Please fix ${formValidator.errors.size} validation errors before submitting.`);
        }
        return;
    }
    
    const memberNameInput = document.getElementById('member-name');
    const memberTypeInput = document.getElementById('member-type');
    const joinDateInput = document.getElementById('join-date');
    const leaveDateInput = document.getElementById('leave-date');
    const memberRosterBody = document.getElementById('member-roster-body');
    
    const name = memberNameInput.value.trim();
    const clubBase = memberTypeInput.value;
    const joinDate = joinDateInput.value;
    const leaveDate = leaveDateInput.value;

    const selectedYear = parseInt(document.getElementById('invoice-year-select').value, 10);
    const duesBreakdown = calculateIndividualDue(joinDate, clubBase, selectedYear, leaveDate);
    const memberId = `member-${Date.now()}`;
    const row = document.createElement('tr');
    
    row.id = memberId;
    row.dataset.due = duesBreakdown.total;
    row.dataset.joinDate = joinDate;
    row.dataset.leaveDate = leaveDate;
    row.dataset.memberType = clubBase;
    row.dataset.name = name;
    row.classList.add('member-row');
    
    row.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">${name}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${joinDate}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${leaveDate || '-'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${clubBase}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium due-cell">${formatDuesBreakdown(duesBreakdown)}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">${duesBreakdown.fullYear > 0 ? 'Yes' : 'No'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">${duesBreakdown.proratedMonths || 0}</td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <button class="btn btn-secondary btn-sm !p-2 edit-member-btn">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fill-rule="evenodd" d="M2 6a2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" /></svg>
            </button>
            <button class="btn btn-danger btn-sm !p-2 remove-member-btn">
                 <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd" /></svg>
            </button>
        </td>
    `;
    
    memberRosterBody.appendChild(row);

    row.querySelector('.edit-member-btn').addEventListener('click', () => editMember(memberId));
    row.querySelector('.remove-member-btn').addEventListener('click', () => {
        row.remove();
        updateTotal();
        updatePagination();
    });
    
    lastSelectedClubBase = clubBase;
    lastSelectedJoinDate = joinDate;
    updateTotal();
    updatePagination();
    
    formValidator.clearAllErrors();
    
    const addMemberForm = document.getElementById('add-member-form');
    addMemberForm.reset();
    joinDateInput.value = lastSelectedJoinDate;
    memberTypeInput.value = lastSelectedClubBase;
    
    showSuccessMessage('Member added successfully!');
    row.classList.add('slide-up');
}

// Feedback functions
function showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-feedback fade-in';
    successDiv.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>${message}</span>
    `;
    
    const addMemberForm = document.getElementById('add-member-form');
    addMemberForm.parentNode.insertBefore(successDiv, addMemberForm.nextSibling);
    
    setTimeout(() => {
        successDiv.remove();
    }, 3000);
}

function showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-feedback fade-in';
    errorDiv.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>${message}</span>
    `;
    
    const addMemberForm = document.getElementById('add-member-form');
    addMemberForm.parentNode.insertBefore(errorDiv, addMemberForm.nextSibling);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

function showFileUploadError(message) {
    const errorContainer = document.getElementById('file-upload-error');
    if (!errorContainer) return;
    
    if (currentErrorTimeout) {
        clearTimeout(currentErrorTimeout);
        currentErrorTimeout = null;
    }
    
    errorContainer.className = 'error-feedback fade-in mb-4';
    errorContainer.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>${message}</span>
    `;
    errorContainer.classList.remove('hidden');
    
    currentErrorTimeout = setTimeout(() => {
        errorContainer.classList.add('hidden');
        currentErrorTimeout = null;
    }, 4000);
}

// Initialize application
function initializeApp() {
    // Hide loading overlay
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.classList.remove('active');
    }
    
    // Set current year
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayFormatted = `${yyyy}-${mm}-${dd}`;
    
    const joinDateInput = document.getElementById('join-date');
    const currentYearSpan = document.getElementById('current-year');
    
    if (joinDateInput) joinDateInput.value = todayFormatted;
    if (currentYearSpan) currentYearSpan.textContent = yyyy;
    
    // Initialize form validation
    const memberNameInput = document.getElementById('member-name');
    const memberTypeInput = document.getElementById('member-type');
    const joinDateInput2 = document.getElementById('join-date');
    const leaveDateInput = document.getElementById('leave-date');
    
    [memberNameInput, memberTypeInput, joinDateInput2, leaveDateInput].forEach(input => {
        if (input) {
            input.addEventListener('blur', () => {
                formValidator.validateField(input.id);
            });
            
            input.addEventListener('input', () => {
                if (formValidator.errors.has(input.id)) {
                    formValidator.clearFieldError(input.id);
                }
            });
        }
    });
    
    // Initialize year selector
    populateYearSelector();
    updatePagination();
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            const activeElement = document.activeElement;
            if (activeElement && activeElement.closest('#add-member-form')) {
                document.getElementById('add-member-form').dispatchEvent(new Event('submit'));
            }
        }
        
        if (e.key === 'Escape') {
            const loadingOverlay = document.getElementById('loading-overlay');
            if (loadingOverlay && loadingOverlay.classList.contains('active')) {
                loadingOverlay.classList.remove('active');
            }
        }
    });
    
    // Performance optimization: Preload critical resources
    requestIdleCallback(() => {
        // Application loaded successfully
    });
}

// PDF generation function - keeping original functionality

// Export functions for use in HTML
window.appFunctions = {
    addMember,
    updateTotal,
    recalculateAllDues,
    showSuccessMessage,
    showErrorMessage,
    showFileUploadError,
    debouncedUpdateTotal,
    formValidator,
    initializeApp
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    if (window.appFunctions && window.appFunctions.initializeApp) {
        window.appFunctions.initializeApp();
    }
}); 