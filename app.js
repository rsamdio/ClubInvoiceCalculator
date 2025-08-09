// Security utility for input sanitization
const SecurityUtils = {
    // Sanitize HTML content to prevent XSS
    sanitizeHTML: function(str) {
        if (typeof str !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
    
    // Sanitize text content (removes all HTML)
    sanitizeText: function(str) {
        if (typeof str !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.textContent || div.innerText || '';
    },
    
    // Validate and sanitize file input
    validateFile: function(file) {
        const allowedTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel', // .xls
            'text/csv', // .csv
            'application/csv' // .csv alternative
        ];
        
        const maxSize = 5 * 1024 * 1024; // 5MB limit
        
        if (!allowedTypes.includes(file.type)) {
            throw new Error('Invalid file type. Please upload Excel (.xlsx, .xls) or CSV files only.');
        }
        
        if (file.size > maxSize) {
            throw new Error('File size too large. Maximum size is 5MB.');
        }
        
        return true;
    },
    
    // Validate date format
    validateDate: function(dateString) {
        if (!dateString || typeof dateString !== 'string') return false;
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateString)) return false;
        
        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date) && date.getFullYear() >= 1900 && date.getFullYear() <= 2100;
    },
    
    // Validate member name
    validateMemberName: function(name) {
        if (!name || typeof name !== 'string') return false;
        const sanitizedName = this.sanitizeText(name).trim();
        return sanitizedName.length >= 2 && sanitizedName.length <= 100 && /^[a-zA-Z\s\-'\.]+$/.test(sanitizedName);
    }
};

// Performance optimization: Use requestIdleCallback for non-critical operations
const requestIdleCallback = window.requestIdleCallback || ((cb) => setTimeout(cb, 1));

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
                { test: (value) => SecurityUtils.validateMemberName(value), message: 'Member name is required and must be 2-100 characters with only letters, spaces, hyphens, apostrophes, and periods' }
            ],
            'member-type': [
                { test: (value) => value.length > 0, message: 'Please select a Club Base' }
            ],
            'join-date': [
                { test: (value) => value.length > 0, message: 'Join date is required' },
                { test: (value) => SecurityUtils.validateDate(value), message: 'Please enter a valid date in YYYY-MM-DD format' }
            ],
            'leave-date': [
                { test: (value) => !value || SecurityUtils.validateDate(value), message: 'Please enter a valid date in YYYY-MM-DD format' },
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
            errorElement.textContent = SecurityUtils.sanitizeText(message);
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

// Utility functions
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
        
        // If join date is on 1st of month, include that month. If after 1st, start from next month
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
                
                // If leave date is on 1st of month, include that month. If after 1st, end at previous month
                let effectiveLeaveMonth = leaveMonth;
                if (leaveDay > 1) {
                    effectiveLeaveMonth = leaveMonth - 1;
                }
                // If leave date is on 1st, we want to include that month, so no adjustment needed
                
                // Ensure we don't go below the join month
                effectiveLeaveMonth = Math.max(effectiveLeaveMonth, effectiveJoinMonth);
                
                if (effectiveLeaveMonth < effectiveJoinMonth) {
                    return { fullYear: 0, prorated: 0, total: 0, proratedMonths: 0 };
                }
                
                let actualMonthsInJoinYear = effectiveLeaveMonth - effectiveJoinMonth + 1; // +1 to include both start and end months
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
            duesBreakdownEl.textContent = `Annual: $${preciseFullYear.toFixed(2)} + Prorated: $${preciseProrated.toFixed(2)}`;
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
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" /></svg>
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
    const sanitizedMessage = SecurityUtils.sanitizeText(message);
    successDiv.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>${sanitizedMessage}</span>
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
    const sanitizedMessage = SecurityUtils.sanitizeText(message);
    errorDiv.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>${sanitizedMessage}</span>
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
    initializeApp,
    downloadCSVTemplate,
    parseExcelFile,
    parseCSVFile,
    validateMemberData,
    showPreview,
    handleFileUpload,
    addBulkMembers,
    resetBulkUpload,
    showSuccessAnimation,
    updatePagination,
    displayCurrentPage,
    goToPage,
    goToPreviousPage,
    goToNextPage,
    changePageSize,
    populateYearSelector,
    updateInvoiceDateDisplay,
    editMember,
    saveMember,
    cancelEdit,
    finishEditing,
    resetCalculator
};

// Bulk Upload Functions
function downloadCSVTemplate() {
    const csvContent = 'Member Name,Join Date,Club Base,Leave Date\nJohn Doe,2024-01-01,Community-Based,\nJane Smith,2024-02-01,University-Based,2024-12-31';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Member Roster Template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

function parseExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                // Remove header row and process data
                const processedData = jsonData.slice(1).filter(row => row.length >= 3);
                resolve(processedData);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function parseCSVFile(file) {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            complete: function(results) {
                if (results.errors.length > 0) {
                    reject(new Error('CSV parsing error: ' + results.errors[0].message));
                    return;
                }
                // Remove header row and process data
                const processedData = results.data.slice(1).filter(row => row.length >= 3);
                resolve(processedData);
            },
            error: function(error) {
                reject(error);
            }
        });
    });
}

function validateMemberData(data) {
    const validatedMembers = [];
    const errors = [];

    data.forEach((row, index) => {
        const [name, joinDate, memberType, leaveDate] = row;
        
        // Validate name using security utility
        if (!SecurityUtils.validateMemberName(name)) {
            errors.push(`Row ${index + 2}: Invalid member name - must be 2-100 characters with only letters, spaces, hyphens, apostrophes, and periods`);
            return;
        }

        // Validate join date using security utility
        if (!SecurityUtils.validateDate(joinDate)) {
            errors.push(`Row ${index + 2}: Invalid join date format (use YYYY-MM-DD)`);
            return;
        }

        // Validate club base with stricter validation
        const validTypes = ['Community-Based', 'University-Based'];
        if (!memberType || typeof memberType !== 'string' || !validTypes.includes(memberType.trim())) {
            errors.push(`Row ${index + 2}: Invalid Club Base (use "Community-Based" or "University-Based")`);
            return;
        }

        // Validate leave date (optional) using security utility
        if (leaveDate && leaveDate.trim() !== '' && !SecurityUtils.validateDate(leaveDate)) {
            errors.push(`Row ${index + 2}: Invalid leave date format (use YYYY-MM-DD or leave blank)`);
            return;
        }

        // Additional validation: leave date should be after join date
        if (leaveDate && leaveDate.trim() !== '') {
            const joinDateObj = new Date(joinDate);
            const leaveDateObj = new Date(leaveDate);
            if (leaveDateObj <= joinDateObj) {
                errors.push(`Row ${index + 2}: Leave date must be after join date`);
                return;
            }
        }

        validatedMembers.push({
            name: SecurityUtils.sanitizeText(name.trim()),
            joinDate: joinDate,
            clubBase: memberType.trim(),
            leaveDate: leaveDate && leaveDate.trim() !== '' ? leaveDate : null
        });
    });

    return { validatedMembers, errors };
}

function showPreview(members) {
    // Clear any existing file upload errors
    const errorContainer = document.getElementById('file-upload-error');
    if (errorContainer) {
        errorContainer.classList.add('hidden');
    }
    
    // Clear any existing error timeout
    if (currentErrorTimeout) {
        clearTimeout(currentErrorTimeout);
        currentErrorTimeout = null;
    }
    
    const previewContent = document.getElementById('preview-content');
    const fileUploadArea = document.getElementById('file-upload-area');
    const uploadPreview = document.getElementById('upload-preview');
    
    const previewHTML = members.map((member, index) => {
        const typeText = member.clubBase === 'Community-Based' ? 'Community-Based ($8)' : 'University-Based ($5)';
        const leaveDateText = member.leaveDate ? ` | Left: ${member.leaveDate}` : '';
        return `
            <div class="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                <div class="flex-1">
                    <span class="font-medium text-gray-800">${member.name}</span>
                    <span class="text-gray-500 ml-3">${member.joinDate}${leaveDateText}</span>
                    <span class="text-gray-500 ml-3">${typeText}</span>
                </div>
            </div>
        `;
    }).join('');

    previewContent.innerHTML = previewHTML;
    
    // Show the action buttons (Add to Roster and Cancel) - restore them if they were hidden
    const actionButtons = uploadPreview.querySelector('.flex.gap-3.mt-4');
    if (actionButtons) {
        actionButtons.style.display = 'flex';
    }
    
    // Hide upload area with smooth transition
    fileUploadArea.classList.add('hidden');
    
    // Show preview after a short delay
    setTimeout(() => {
        uploadPreview.classList.remove('hidden');
    }, 300);
}

function handleFileUpload(file) {
    // Show loading state
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.classList.add('active');
    }
    
    const fileInput = document.getElementById('file-input');
    
    // Validate file using security utility
    try {
        SecurityUtils.validateFile(file);
    } catch (error) {
        showFileUploadError(error.message);
        fileInput.value = '';
        if (loadingOverlay) {
            loadingOverlay.classList.remove('active');
        }
        return;
    }
    
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    let parsePromise;
    if (fileExtension === 'csv') {
        parsePromise = parseCSVFile(file);
    } else if (['xlsx', 'xls'].includes(fileExtension)) {
        parsePromise = parseExcelFile(file);
    } else {
        showFileUploadError('Unsupported file format. Please upload a CSV or Excel file.');
        fileInput.value = '';
        if (loadingOverlay) {
            loadingOverlay.classList.remove('active');
        }
        return;
    }

    parsePromise.then(data => {
        const validation = validateMemberData(data);
        
        if (validation.errors.length > 0) {
            const errorMessage = 'Validation errors found:\n\n' + validation.errors.join('\n');
            showFileUploadError(errorMessage);
            fileInput.value = ''; // Clear the file input so the same file can be selected again
            return;
        }

        window.parsedMembers = validation.validatedMembers;
        showPreview(validation.validatedMembers);
    }).catch(error => {
        showFileUploadError('Error parsing file: ' + error.message);
        fileInput.value = ''; // Clear the file input so the same file can be selected again
    }).finally(() => {
        // Hide loading state
        if (loadingOverlay) {
            loadingOverlay.classList.remove('active');
        }
    });
}

function addBulkMembers() {
    if (!window.parsedMembers || window.parsedMembers.length === 0) return;

    const selectedYear = parseInt(document.getElementById('invoice-year-select').value, 10);
    const memberRosterBody = document.getElementById('member-roster-body');
    
    window.parsedMembers.forEach(member => {
        const duesBreakdown = calculateIndividualDue(member.joinDate, member.clubBase, selectedYear, member.leaveDate);
        const memberId = `member-${Date.now()}-${Math.random()}`;
        
        const row = document.createElement('tr');
        row.id = memberId;
        row.dataset.due = duesBreakdown.total;
        row.dataset.joinDate = member.joinDate;
        row.dataset.leaveDate = member.leaveDate;
        row.dataset.memberType = member.clubBase;
        row.dataset.name = member.name;
        row.classList.add('member-row');
        
        // Sanitize member data to prevent XSS
        const sanitizedName = SecurityUtils.sanitizeText(member.name);
        const sanitizedJoinDate = SecurityUtils.sanitizeText(member.joinDate);
        const sanitizedLeaveDate = member.leaveDate ? SecurityUtils.sanitizeText(member.leaveDate) : '-';
        const sanitizedClubBase = SecurityUtils.sanitizeText(member.clubBase);
        
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">${sanitizedName}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${sanitizedJoinDate}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${sanitizedLeaveDate}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${sanitizedClubBase}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium due-cell">${formatDuesBreakdown(duesBreakdown)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">${duesBreakdown.fullYear > 0 ? 'Yes' : 'No'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">${duesBreakdown.proratedMonths || 0}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button class="btn btn-secondary btn-sm !p-2 edit-member-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" /></svg>
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
    });

    updateTotal();
    updatePagination();
    
    // Show success animation and return to upload area
    showSuccessAnimation();
}

function resetBulkUpload() {
    window.parsedMembers = [];
    const uploadPreview = document.getElementById('upload-preview');
    const fileInput = document.getElementById('file-input');
    const fileUploadArea = document.getElementById('file-upload-area');
    
    uploadPreview.classList.add('hidden');
    fileInput.value = '';
    
    // Clear any file upload errors
    const errorContainer = document.getElementById('file-upload-error');
    if (errorContainer) {
        errorContainer.classList.add('hidden');
    }
    
    // Clear any existing error timeout
    if (currentErrorTimeout) {
        clearTimeout(currentErrorTimeout);
        currentErrorTimeout = null;
    }
    
    // Return to upload area after a short delay
    setTimeout(() => {
        fileUploadArea.classList.remove('hidden');
    }, 300);
}

function showSuccessAnimation() {
    const previewContent = document.getElementById('preview-content');
    const uploadPreview = document.getElementById('upload-preview');
    
    // Replace preview content with success message
    const successHTML = `
        <div class="text-center py-8 success-animation">
            <div class="success-icon mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </div>
            <h3 class="text-lg font-bold text-gray-800 mb-2">Successfully Added!</h3>
            <p class="text-gray-600 mb-4">${window.parsedMembers.length} member(s) have been added to your roster.</p>
            <div class="flex gap-3 justify-center">
                <button type="button" id="upload-more-btn" class="btn btn-primary text-sm px-6 py-3 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Upload More
                </button>
            </div>
        </div>
    `;
    
    // Replace the entire preview content (including buttons)
    previewContent.innerHTML = successHTML;
    
    // Hide the action buttons (Add to Roster and Cancel)
    const actionButtons = uploadPreview.querySelector('.flex.gap-3.mt-4');
    if (actionButtons) {
        actionButtons.style.display = 'none';
    }
    
    // Add event listener for upload more button
    document.getElementById('upload-more-btn').addEventListener('click', () => {
        resetBulkUpload();
    });
    
    // Auto-return to upload area after 3 seconds
    setTimeout(() => {
        resetBulkUpload();
    }, 3000);
}

// Pagination Functions
function updatePagination() {
    const paginationControls = document.getElementById('pagination-controls');
    const pageSizeSelect = document.getElementById('page-size-select');
    const pageSizeSelectMobile = document.getElementById('page-size-select-mobile');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const prevPageBtnMobile = document.getElementById('prev-page-mobile');
    const nextPageBtnMobile = document.getElementById('next-page-mobile');
    const pageNumbers = document.getElementById('page-numbers');
    const pageNumbersMobile = document.getElementById('page-numbers-mobile');
    const startEntry = document.getElementById('start-entry');
    const endEntry = document.getElementById('end-entry');
    const totalEntries = document.getElementById('total-entries');
    const startEntryMobile = document.getElementById('start-entry-mobile');
    const endEntryMobile = document.getElementById('end-entry-mobile');
    const totalEntriesMobile = document.getElementById('total-entries-mobile');
    const memberRosterBody = document.getElementById('member-roster-body');

    // Get all member rows
    allMemberRows = Array.from(memberRosterBody.querySelectorAll('tr.member-row'));
    
    const totalMembers = allMemberRows.length;
    const totalPages = Math.ceil(totalMembers / pageSize);
    
    // Show/hide pagination controls
    if (totalMembers > pageSize) {
        paginationControls.classList.remove('hidden');
    } else {
        paginationControls.classList.add('hidden');
    }
    
    // Update pagination info
    const start = (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, totalMembers);
    
    if (startEntry) startEntry.textContent = totalMembers > 0 ? start : 0;
    if (endEntry) endEntry.textContent = end;
    if (totalEntries) totalEntries.textContent = totalMembers;
    
    // Update mobile pagination info
    if (startEntryMobile) startEntryMobile.textContent = totalMembers > 0 ? start : 0;
    if (endEntryMobile) endEntryMobile.textContent = end;
    if (totalEntriesMobile) totalEntriesMobile.textContent = totalMembers;
    
    // Update page size selectors
    if (pageSizeSelect) pageSizeSelect.value = pageSize;
    if (pageSizeSelectMobile) pageSizeSelectMobile.value = pageSize;
    
    // Update navigation buttons
    if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPage === totalPages;
    
    // Update mobile navigation buttons
    if (prevPageBtnMobile) prevPageBtnMobile.disabled = currentPage === 1;
    if (nextPageBtnMobile) nextPageBtnMobile.disabled = currentPage === totalPages;
    
    // Generate page numbers
    if (pageNumbers) {
        pageNumbers.innerHTML = '';
        const maxVisiblePages = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `px-3 py-1 text-sm border rounded-md transition-colors whitespace-nowrap min-w-[2rem] ${
                i === currentPage 
                    ? 'bg-blue-500 text-white border-blue-500' 
                    : 'border-gray-300 hover:bg-gray-50'
            }`;
            pageBtn.textContent = i;
            pageBtn.addEventListener('click', () => goToPage(i));
            pageNumbers.appendChild(pageBtn);
        }
    }
    
    // Generate mobile page numbers (show fewer pages on mobile)
    if (pageNumbersMobile) {
        pageNumbersMobile.innerHTML = '';
        const maxVisiblePagesMobile = 3; // Show fewer pages on mobile
        let startPageMobile = Math.max(1, currentPage - Math.floor(maxVisiblePagesMobile / 2));
        let endPageMobile = Math.min(totalPages, startPageMobile + maxVisiblePagesMobile - 1);
        
        if (endPageMobile - startPageMobile + 1 < maxVisiblePagesMobile) {
            startPageMobile = Math.max(1, endPageMobile - maxVisiblePagesMobile + 1);
        }
        
        for (let i = startPageMobile; i <= endPageMobile; i++) {
            const pageBtnMobile = document.createElement('button');
            pageBtnMobile.className = `px-2 py-1 text-xs border rounded transition-colors whitespace-nowrap min-w-[1.5rem] ${
                i === currentPage 
                    ? 'bg-blue-500 text-white border-blue-500' 
                    : 'border-gray-300 hover:bg-gray-50'
            }`;
            pageBtnMobile.textContent = i;
            pageBtnMobile.addEventListener('click', () => goToPage(i));
            pageNumbersMobile.appendChild(pageBtnMobile);
        }
    }
    
    // Show current page rows
    displayCurrentPage();
}

function displayCurrentPage() {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    
    // Hide all rows
    allMemberRows.forEach(row => {
        row.style.display = 'none';
    });
    
    // Show only current page rows
    allMemberRows.slice(start, end).forEach(row => {
        row.style.display = '';
    });
}

function goToPage(page) {
    currentPage = page;
    displayCurrentPage();
    updatePagination();
}

function goToPreviousPage() {
    if (currentPage > 1) {
        goToPage(currentPage - 1);
    }
}

function goToNextPage() {
    const totalPages = Math.ceil(allMemberRows.length / pageSize);
    if (currentPage < totalPages) {
        goToPage(currentPage + 1);
    }
}

function changePageSize(newSize) {
    pageSize = parseInt(newSize);
    currentPage = 1; // Reset to first page
    updatePagination();
}

// Year Selector Functions
function populateYearSelector() {
    const invoiceYearSelect = document.getElementById('invoice-year-select');
    if (!invoiceYearSelect) return;
    
    const currentYear = new Date().getFullYear();
    const startInvoiceYear = 2023;
    const endInvoiceYear = currentYear + 25;
    
    for (let year = startInvoiceYear; year <= endInvoiceYear; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        invoiceYearSelect.appendChild(option);
    }
    invoiceYearSelect.value = currentYear + 1;
    updateInvoiceDateDisplay();
}

function updateInvoiceDateDisplay() {
    const invoiceYearSelect = document.getElementById('invoice-year-select');
    const invoiceDateDisplay = document.getElementById('invoice-date-display');
    
    if (invoiceYearSelect && invoiceDateDisplay) {
        const selectedYear = invoiceYearSelect.value;
        invoiceDateDisplay.textContent = `Jan 1st, ${selectedYear}`;
    }
}

// Member Management Functions
function editMember(memberId) {
    const row = document.getElementById(memberId);
    if (!row || row.classList.contains('editing')) return;

    document.querySelectorAll('.edit-member-btn').forEach(btn => btn.disabled = true);
    row.classList.add('editing');

    const name = row.dataset.name;
    const joinDate = row.dataset.joinDate;
    const leaveDate = row.dataset.leaveDate;
    const memberType = row.dataset.memberType;

    // Enhanced input fields with better styling and visibility - sanitized to prevent XSS
    const sanitizedName = SecurityUtils.sanitizeText(name);
    const sanitizedJoinDate = SecurityUtils.sanitizeText(joinDate);
    const sanitizedLeaveDate = leaveDate ? SecurityUtils.sanitizeText(leaveDate) : '';
    
    row.cells[0].innerHTML = `<input type="text" value="${sanitizedName}" class="edit-mode-input" placeholder="Enter member name">`;
    row.cells[1].innerHTML = `<input type="date" value="${sanitizedJoinDate}" class="edit-mode-input">`;
    row.cells[2].innerHTML = `<input type="date" value="${sanitizedLeaveDate}" class="edit-mode-input" placeholder="Leave date (optional)">`;
    row.cells[3].innerHTML = `
        <select class="edit-mode-select">
            <option value="Community-Based" ${memberType === 'Community-Based' ? 'selected' : ''}>Community-Based ($8)</option>
            <option value="University-Based" ${memberType === 'University-Based' ? 'selected' : ''}>University-Based ($5)</option>
        </select>
    `;
    row.cells[4].innerHTML = '<span class="text-gray-400 italic">Calculating...</span>';
    row.cells[5].innerHTML = '<span class="text-gray-400 italic">Calculating...</span>';
    row.cells[6].innerHTML = '<span class="text-gray-400 italic">Calculating...</span>';
    row.cells[7].innerHTML = `
        <div class="flex space-x-2">
            <button class="btn btn-primary btn-sm !p-2 save-member-btn" title="Save changes">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>
            </button>
            <button class="btn btn-secondary btn-sm !p-2 cancel-edit-btn" title="Cancel editing">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
            </button>
        </div>
    `;

    // Add event listeners
    row.querySelector('.save-member-btn').addEventListener('click', () => saveMember(memberId));
    row.querySelector('.cancel-edit-btn').addEventListener('click', () => cancelEdit(memberId));
    
    // Auto-focus on the name input for better UX
    setTimeout(() => {
        const nameInput = row.cells[0].querySelector('input');
        if (nameInput) {
            nameInput.focus();
            nameInput.select();
        }
    }, 100);
    
    // Add keyboard support for better UX
    const inputs = row.querySelectorAll('input, select');
    inputs.forEach((input, index) => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (index < inputs.length - 1) {
                    inputs[index + 1].focus();
                } else {
                    saveMember(memberId);
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit(memberId);
            }
        });
    });
}

function saveMember(memberId) {
    const row = document.getElementById(memberId);
    if (!row) return;

    const newName = row.cells[0].querySelector('input').value.trim();
    const newJoinDate = row.cells[1].querySelector('input').value;
    const newLeaveDate = row.cells[2].querySelector('input').value;
    const newMemberType = row.cells[3].querySelector('select').value;

    // Enhanced validation for edit mode
    if (!newName) {
        showErrorMessage('Please enter a member name');
        row.cells[0].querySelector('input').focus();
        return;
    }

    if (!newJoinDate) {
        showErrorMessage('Please select a join date');
        row.cells[1].querySelector('input').focus();
        return;
    }

    row.dataset.name = newName;
    row.dataset.joinDate = newJoinDate;
    row.dataset.leaveDate = newLeaveDate;
    row.dataset.memberType = newMemberType;

    const selectedYear = parseInt(document.getElementById('invoice-year-select').value, 10);
    const duesBreakdown = calculateIndividualDue(newJoinDate, newMemberType, selectedYear, newLeaveDate);
    row.dataset.due = duesBreakdown.total;

    row.cells[0].textContent = newName;
    row.cells[1].textContent = newJoinDate;
    row.cells[2].textContent = newLeaveDate || '-';
    row.cells[3].textContent = newMemberType;
    row.cells[4].innerHTML = formatDuesBreakdown(duesBreakdown);
    row.cells[4].classList.add('due-cell');
    row.cells[5].textContent = duesBreakdown.fullYear > 0 ? 'Yes' : 'No';
    row.cells[6].textContent = duesBreakdown.proratedMonths || 0;
    
    finishEditing(row, memberId);
    recalculateAllDues();
    
    // Show success feedback
    row.style.backgroundColor = '#f0f9ff';
    setTimeout(() => {
        row.style.backgroundColor = '';
    }, 1000);
}

function cancelEdit(memberId) {
    const row = document.getElementById(memberId);
    if (!row) return;

    const name = row.dataset.name;
    const joinDate = row.dataset.joinDate;
    const leaveDate = row.dataset.leaveDate;
    const memberType = row.dataset.memberType;
    const selectedYear = parseInt(document.getElementById('invoice-year-select').value, 10);
    const duesBreakdown = calculateIndividualDue(joinDate, memberType, selectedYear, leaveDate);

    row.cells[0].textContent = name;
    row.cells[1].textContent = joinDate;
    row.cells[2].textContent = leaveDate || '-';
    row.cells[3].textContent = memberType;
    row.cells[4].innerHTML = formatDuesBreakdown(duesBreakdown);
    row.cells[4].classList.add('due-cell');
    row.cells[5].textContent = duesBreakdown.fullYear > 0 ? 'Yes' : 'No';
    row.cells[6].textContent = duesBreakdown.proratedMonths || 0;

    finishEditing(row, memberId);
}

function finishEditing(row, memberId) {
    row.classList.remove('editing');
    row.cells[7].innerHTML = `
        <button class="btn btn-secondary btn-sm !p-2 edit-member-btn">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" /></svg>
        </button>
        <button class="btn btn-danger btn-sm !p-2 remove-member-btn">
             <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd" /></svg>
        </button>
    `;
    row.querySelector('.edit-member-btn').addEventListener('click', () => editMember(memberId));
    row.querySelector('.remove-member-btn').addEventListener('click', () => {
        row.remove();
        updateTotal();
    });
    document.querySelectorAll('.edit-member-btn').forEach(btn => btn.disabled = false);
}

function resetCalculator() {
    const memberRosterBody = document.getElementById('member-roster-body');
    memberRosterBody.innerHTML = '';
    allMemberRows = [];
    currentPage = 1;
    updateTotal();
    updatePagination();
}

// Update the exported functions
window.appFunctions = {
    addMember,
    updateTotal,
    recalculateAllDues,
    showSuccessMessage,
    showErrorMessage,
    showFileUploadError,
    debouncedUpdateTotal,
    formValidator,
    initializeApp,
    downloadCSVTemplate,
    parseExcelFile,
    parseCSVFile,
    validateMemberData,
    showPreview,
    handleFileUpload,
    addBulkMembers,
    resetBulkUpload,
    showSuccessAnimation,
    updatePagination,
    displayCurrentPage,
    goToPage,
    goToPreviousPage,
    goToNextPage,
    changePageSize,
    populateYearSelector,
    updateInvoiceDateDisplay,
    editMember,
    saveMember,
    cancelEdit,
    finishEditing,
    resetCalculator
}; 