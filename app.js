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
    
    // Validate date format (calendar-correct, local midnight)
    validateDate: function(dateString) {
        if (!dateString || typeof dateString !== 'string') return false;
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateString)) return false;

        const parts = dateString.split('-').map(Number);
        const date = new Date(parts[0], parts[1] - 1, parts[2]);
        return (
            date.getFullYear() === parts[0] &&
            date.getMonth() === parts[1] - 1 &&
            date.getDate() === parts[2] &&
            parts[0] >= 1900 &&
            parts[0] <= 2100
        );
    },
    
    // Validate member name
    validateMemberName: function(name) {
        if (!name || typeof name !== 'string') return false;
        const sanitizedName = this.sanitizeText(name).replace(/^\uFEFF/, '').trim();
        return sanitizedName.length >= 2 && sanitizedName.length <= 100 && /^[a-zA-Z\s\-'\.]+$/.test(sanitizedName);
    }
};

// Performance optimization: Use requestIdleCallback for non-critical operations
const requestIdleCallback = window.requestIdleCallback || ((cb) => setTimeout(cb, 1));

// DOM Cache for frequently accessed elements
const DOMCache = {
    elements: new Map(),
    
    get(id) {
        if (!this.elements.has(id)) {
            const element = document.getElementById(id);
            if (element) {
                this.elements.set(id, element);
            }
            return element;
        }
        return this.elements.get(id);
    },
    
    clear() {
        this.elements.clear();
    },
    
    // Pre-cache critical elements
    initialize() {
        const criticalElements = [
            'member-roster-body',
            'pagination-controls',
            'add-member-form',
            'file-upload-area',
            'upload-preview',
            'base-invoice-amount',
            'total-invoice-amount',
            'tax-breakdown',
            'total-members',
            'total-prorated-months',
            'invoice-year-select',
            'tax-percentage',
            'currency-rate'
        ];
        
        criticalElements.forEach(id => this.get(id));
    }
};

// Event Delegation Manager
const EventManager = {
    handlers: new Map(),
    
    delegate(container, selector, eventType, handler) {
        // Include selector in key so multiple delegated handlers can coexist per event type
        const key = `${container.id}-${eventType}-${selector}`;
        
        if (!this.handlers.has(key)) {
            const delegatedHandler = (e) => {
                const target = e.target.closest(selector);
                if (target && container.contains(target)) {
                    handler(e, target);
                }
            };
            
            this.handlers.set(key, delegatedHandler);
            container.addEventListener(eventType, delegatedHandler);
        }
    },
    
    removeDelegation(container, eventType, selector) {
        // Match the key format used in delegate
        const key = `${container.id}-${eventType}-${selector}`;
        const handler = this.handlers.get(key);
        if (handler) {
            container.removeEventListener(eventType, handler);
            this.handlers.delete(key);
        }
    },
    
    cleanup() {
        this.handlers.forEach((handler, key) => {
            try {
                const [containerId, eventType] = key.split('-');
                const container = document.getElementById(containerId);
                if (container) {
                    container.removeEventListener(eventType, handler);
                }
            } catch (_) { /* ignore */ }
        });
        this.handlers.clear();
    }
};

// Performance Monitor
const PerformanceMonitor = {
    metrics: new Map(),
    
    startTimer(name) {
        this.metrics.set(name, performance.now());
    },
    
    endTimer(name) {
        const startTime = this.metrics.get(name);
        if (startTime) {
            const duration = performance.now() - startTime;
            this.metrics.delete(name);
            

            
            return duration;
        }
        return 0;
    },
    
    trackUserInteraction(action, duration) {
        if (window.gtag) {
            gtag('event', 'user_interaction', {
                action,
                duration: Math.round(duration),
                timestamp: Date.now()
            });
        }
        
        FirebaseAnalyticsChecker.logEvent('user_interaction', {
            action,
            duration: Math.round(duration)
        });
    }
};

// Error Handler with Retry Mechanism
const ErrorHandler = {
    async withRetry(fn, maxRetries = 3, delay = 1000) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await fn();
            } catch (error) {
                if (i === maxRetries - 1) {
                    throw error;
                }
                
                // Exponential backoff
                const backoffDelay = delay * Math.pow(2, i);
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
                

            }
        }
    },
    
    handleError(error, context = 'unknown') {
        // Error logging removed for production
        
        if (window.gtag) {
            gtag('event', 'exception', {
                description: error.message,
                fatal: false,
                context: context
            });
        }
        
        FirebaseAnalyticsChecker.logEvent('exception', {
            description: error.message,
            fatal: false,
            context: context
        });
        
        const errorMessage = this.getUserFriendlyMessage(error, context);
        showErrorMessage(errorMessage);
    },
    
    getUserFriendlyMessage(error, context) {
        const errorMessages = {
            'network': 'Network connection issue. Please check your internet connection and try again.',
            'firebase': 'Authentication service temporarily unavailable. Please try again in a moment.',
            'validation': 'Please check your input and try again.',
            'file': 'File processing error. Please ensure your file is in the correct format.',
            'pdf': 'PDF generation failed. Please try again.',
            'default': 'An unexpected error occurred. Please refresh the page and try again.'
        };
        
        return errorMessages[context] || errorMessages.default;
    }
};

// Circuit Breaker Pattern for External Services
const CircuitBreaker = {
    failures: new Map(),
    thresholds: new Map(),
    
    async execute(serviceName, fn, failureThreshold = 5, timeout = 30000) {
        const key = serviceName;
        
        // Check if circuit is open
        if (this.isOpen(key)) {
            throw new Error(`${serviceName} service is temporarily unavailable`);
        }
        
        try {
            // Execute with timeout
            const result = await Promise.race([
                fn(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), timeout)
                )
            ]);
            
            // Reset failure count on success
            this.failures.set(key, 0);
            return result;
            
        } catch (error) {
            // Increment failure count
            const currentFailures = this.failures.get(key) || 0;
            this.failures.set(key, currentFailures + 1);
            
            // Open circuit if threshold exceeded
            if (currentFailures + 1 >= failureThreshold) {
                this.thresholds.set(key, Date.now() + 60000); // 1 minute timeout
            }
            
            throw error;
        }
    },
    
    isOpen(key) {
        const threshold = this.thresholds.get(key);
        return threshold && Date.now() < threshold;
    },
    
    reset(key) {
        this.failures.delete(key);
        this.thresholds.delete(key);
    }
};

// Global variables
let bulkImportGeneration = 0;
let bulkAddInProgress = false;
let bulkImportActive = false;
let pendingExcelWorkbook = null;
let pendingGoogleSpreadsheetId = null;
let pendingSheetPickerOptions = null;

const DEFAULT_BULK_COLUMN_INDEX = {
    name: 0,
    joinDate: 1,
    clubBase: 2,
    leaveDate: 3
};

const BULK_COLUMN_HEADERS = {
    name: ['member name', 'full name', 'member'],
    joinDate: ['join date', 'joining date', 'date joined'],
    clubBase: ['club base', 'member type', 'club type'],
    leaveDate: ['leave date', 'date left', 'termination date', 'end date', 'exit date']
};

const BULK_HEADER_LABELS = new Set([
    'member name', 'full name', 'name',
    'join date', 'joining date', 'date joined',
    'club base', 'member type', 'club type',
    'leave date', 'date left'
]);
let appInitialized = false;

function clearSessionRoster() {
    const memberRosterBody = document.getElementById('member-roster-body');
    if (memberRosterBody) {
        memberRosterBody.innerHTML = '';
    }
    window.allMemberRows = [];
    allMemberRows = window.allMemberRows;
    currentPage = 1;
    rosterSearchQuery = '';
    const rosterSearchInput = document.getElementById('roster-search-input');
    if (rosterSearchInput) {
        rosterSearchInput.value = '';
    }
    updateRosterSearchStatus();
    updateTotal();
    updatePagination();
}
let lastSelectedClubBase = '';
let lastSelectedJoinDate = '';
let currentPage = 1;
let pageSize = 10;
let rosterSearchQuery = '';
// Global array to track all member rows
window.allMemberRows = window.allMemberRows || [];
let allMemberRows = window.allMemberRows;
let currentErrorTimeout = null;
let currentUser = null;
let isAuthenticated = false;

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

// Debounce save operations to reduce write costs
let saveDebounceTimer = null;
const SAVE_DEBOUNCE_DELAY = 2000; // 2 seconds

function debouncedSaveUserData(userUid) {
    if (saveDebounceTimer) {
        clearTimeout(saveDebounceTimer);
    }

    saveDebounceTimer = setTimeout(async () => {
        if (!window.isAuthenticated || !window.currentUser || window.currentUser.uid !== userUid) {
            saveDebounceTimer = null;
            return;
        }
        const data = getCurrentData();
        await saveUserData(userUid, data);
        saveDebounceTimer = null;
    }, SAVE_DEBOUNCE_DELAY);
}

// Client-side data cache to reduce Firestore reads
const DataCache = {
    cache: new Map(),
    ttl: 10 * 60 * 1000, // 10 minutes
    
    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }
        return item.data;
    },
    
    set(key, data) {
        this.cache.set(key, {
            data,
            expiry: Date.now() + this.ttl
        });
    },
    
    clear() {
        this.cache.clear();
    }
};

// Document existence cache to track user document existence in memory
const documentExistsCache = {
    cache: new Set(),
    
    has(uid) {
        return this.cache.has(uid);
    },
    
    add(uid) {
        this.cache.add(uid);
    },
    
    clear() {
        this.cache.clear();
    }
};

// Lazy-load external vendor scripts to reduce initial JS payload
async function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
        try {
            if (window.__loadedScripts && window.__loadedScripts[src]) {
                resolve();
                return;
            }
            const existing = document.querySelector(`script[data-dynamic="${src}"]`);
            if (existing) {
                existing.addEventListener('load', () => resolve());
                existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)));
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.defer = true;
            script.dataset.dynamic = src;
            script.onload = () => {
                window.__loadedScripts = window.__loadedScripts || {};
                window.__loadedScripts[src] = true;
                resolve();
            };
            script.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(script);
        } catch (e) {
            reject(e);
        }
    });
}

async function ensureXLSXLoaded() {
    if (window.XLSX) return;
    await loadScriptOnce('./vendor/xlsx.full.min.js');
}

async function ensurePapaLoaded() {
    if (window.Papa) return;
    await loadScriptOnce('./vendor/papaparse.min.js');
}

// Core calculation functions
function normalizeLeaveDateStr(leaveDateStr) {
    if (leaveDateStr === null || leaveDateStr === undefined) return null;
    const trimmed = String(leaveDateStr).trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
    return trimmed;
}

function calculateIndividualDue(joinDateStr, clubBase, invoiceYear, leaveDateStr = null) {
    leaveDateStr = normalizeLeaveDateStr(leaveDateStr);
    const joinDate = new Date(joinDateStr + 'T00:00:00');
    const invoiceDate = new Date(invoiceYear, 0, 1);
    const baseDues = clubBase === 'Community-Based' ? 8 : 5;
    const joinYear = joinDate.getFullYear();
    
    // Calculate dues for member

    // Calculate prorated due per month (rounded to 2 decimals)
    const proratedDuePerMonth = Math.round((baseDues / 12) * 100) / 100;

    // Handle members who joined in the previous year (invoiceYear - 1)
    if (joinYear === invoiceYear - 1) {
        const joinMonth = joinDate.getMonth();
        const joinDay = joinDate.getDate();
        
        // If join date is on 1st of month, include that month. If after 1st, start from next month
        let effectiveJoinMonth = joinMonth;
        if (joinDay > 1) {
            effectiveJoinMonth += 1;
        }
        
        // Calculate prorated dues based on the months they were active in the previous year
        const monthsInJoinYear = Math.max(0, 12 - effectiveJoinMonth);
        let proratedDues = Math.round(proratedDuePerMonth * monthsInJoinYear * 100) / 100;

        // Handle leave date if provided
        if (leaveDateStr) {
            const leaveDate = new Date(leaveDateStr + 'T00:00:00');
            if (leaveDate < invoiceDate) {
                let effectiveLeaveMonth = leaveDate.getMonth();
                effectiveLeaveMonth = Math.max(effectiveLeaveMonth, effectiveJoinMonth);
                
                if (effectiveLeaveMonth < effectiveJoinMonth) {
                    return { fullYear: 0, prorated: 0, total: 0, proratedMonths: 0 };
                }
                
                let actualMonthsInJoinYear = effectiveLeaveMonth - effectiveJoinMonth + 1;
                actualMonthsInJoinYear = Math.max(0, actualMonthsInJoinYear);
                proratedDues = Math.round(proratedDuePerMonth * actualMonthsInJoinYear * 100) / 100;
                
                return { fullYear: 0, prorated: proratedDues, total: proratedDues, proratedMonths: actualMonthsInJoinYear };
            }
        }
        
        const total = Math.round((baseDues + proratedDues) * 100) / 100;
        return { fullYear: baseDues, prorated: proratedDues, total: total, proratedMonths: monthsInJoinYear };
    }

    // Handle members who joined in the current invoice year
    if (joinYear === invoiceYear) {
        // Members who join in the current invoice year should not owe any dues for that year
        // They will start owing dues from the next year onwards
        return { fullYear: 0, prorated: 0, total: 0, proratedMonths: 0 };
    }

    // Handle members who joined before the previous year (full year dues)
    if (joinYear < invoiceYear - 1) {
        // Check if they have a leave date before the invoice year
        if (leaveDateStr && leaveDateStr.trim() !== '') {
            const leaveDate = new Date(leaveDateStr + 'T00:00:00');
            if (leaveDate < invoiceDate) {
                return { fullYear: 0, prorated: 0, total: 0, proratedMonths: 0 };
            }
        }
        return { fullYear: baseDues, prorated: 0, total: baseDues, proratedMonths: 0 };
    }

    // Default case: no dues
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

function formatLocalDuesBreakdown(duesBreakdown) {
    const { fullYear, prorated, total } = duesBreakdown;
    const currencyRate = parseFloat(document.getElementById('currency-rate')?.value) || 96;
    
    if (total === 0) {
        return '<span class="text-gray-400">0.00</span>';
    }
    
    // Calculate local currency amounts with proper rounding
    const fullYearLocal = Math.round(fullYear * currencyRate * 100) / 100;
    const proratedLocal = Math.round(prorated * currencyRate * 100) / 100;
    const totalLocal = fullYearLocal + proratedLocal; // Use sum of individual calculations, not direct conversion
    
    let breakdown = '';
    
    if (fullYear > 0 && prorated > 0) {
        breakdown = `${fullYearLocal.toFixed(2)} + ${proratedLocal.toFixed(2)} = ${totalLocal.toFixed(2)}`;
    } else if (fullYear > 0) {
        breakdown = `${fullYearLocal.toFixed(2)} + 0.00 = ${totalLocal.toFixed(2)}`;
    } else if (prorated > 0) {
        breakdown = `0.00 + ${proratedLocal.toFixed(2)} = ${totalLocal.toFixed(2)}`;
    }
    
    return breakdown;
}

function formatLocalDuesWithTaxBreakdown(duesBreakdown) {
    const { fullYear, prorated, total } = duesBreakdown;
    const currencyRate = parseFloat(document.getElementById('currency-rate')?.value) || 96;
    const taxPercentage = parseFloat(document.getElementById('tax-percentage')?.value) || 0;
    
    if (total === 0) {
        return '<span class="text-gray-400">0.00</span>';
    }
    
    // Calculate local currency amounts with proper rounding
    const fullYearLocal = Math.round(fullYear * currencyRate * 100) / 100;
    const proratedLocal = Math.round(prorated * currencyRate * 100) / 100;
    const baseLocal = fullYearLocal + proratedLocal;
    
    // Calculate tax on local amounts
    const taxOnFullYearLocal = Math.round((fullYearLocal * taxPercentage) / 100 * 100) / 100;
    const taxOnProratedLocal = Math.round((proratedLocal * taxPercentage) / 100 * 100) / 100;
    const taxLocal = taxOnFullYearLocal + taxOnProratedLocal;
    
    const totalWithTaxLocal = baseLocal + taxLocal;
    
    let breakdown = '';
    
    if (baseLocal > 0 && taxLocal > 0) {
        breakdown = `${baseLocal.toFixed(2)} + ${taxLocal.toFixed(2)} = ${totalWithTaxLocal.toFixed(2)}`;
    } else if (baseLocal > 0) {
        breakdown = `${baseLocal.toFixed(2)} + 0.00 = ${totalWithTaxLocal.toFixed(2)}`;
    } else {
        breakdown = `0.00 + 0.00 = ${totalWithTaxLocal.toFixed(2)}`;
    }
    
    return breakdown;
}

// UI update functions
function updateTotal() {
    PerformanceMonitor.startTimer('updateTotal');

    let baseTotal = 0;
    let totalFullYear = 0;
    let totalProrated = 0;
    let totalMembersWithFullYear = 0;
    let totalProratedMonths = 0;

    const selectedYear = getSelectedInvoiceYear();
    const memberRosterBody = DOMCache.get('member-roster-body');
    const memberRows = memberRosterBody ? memberRosterBody.querySelectorAll('tr') : [];

    memberRows.forEach(row => {
        if (row.classList.contains('editing')) return;

        const joinDate = row.dataset.joinDate;
        const leaveDate = normalizeLeaveDateStr(row.dataset.leaveDate);
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

    const taxOnAnnualDues = Math.round((totalFullYear * taxPercentage) / 100 * 100) / 100;
    const taxOnProratedDues = Math.round((totalProrated * taxPercentage) / 100 * 100) / 100;
    const taxAmount = taxOnAnnualDues + taxOnProratedDues;
    const totalWithTax = Math.round((baseTotal + taxAmount) * 100) / 100;

    const baseInvoiceAmountEl = DOMCache.get('base-invoice-amount');
    const totalInvoiceAmountEl = DOMCache.get('total-invoice-amount');
    const taxBreakdownEl = DOMCache.get('tax-breakdown');
    const duesBreakdownEl = document.getElementById('dues-breakdown');
    const totalMembersEl = DOMCache.get('total-members');
    const totalProratedMonthsEl = DOMCache.get('total-prorated-months');

    if (baseInvoiceAmountEl) baseInvoiceAmountEl.textContent = `$${baseTotal.toFixed(2)}`;
    if (totalInvoiceAmountEl) totalInvoiceAmountEl.textContent = `$${totalWithTax.toFixed(2)}`;
    if (taxBreakdownEl) taxBreakdownEl.textContent = `Tax: $${taxOnAnnualDues.toFixed(2)} + $${taxOnProratedDues.toFixed(2)} (${taxPercentage}%)`;

    if (duesBreakdownEl) {
        const preciseFullYear = Math.round(totalFullYear * 100) / 100;
        const preciseProrated = Math.round(totalProrated * 100) / 100;
        duesBreakdownEl.textContent = `Annual: $${preciseFullYear.toFixed(2)} + Prorated: $${preciseProrated.toFixed(2)}`;
    }

    if (totalMembersEl) totalMembersEl.textContent = totalMembersWithFullYear;
    if (totalProratedMonthsEl) totalProratedMonthsEl.textContent = totalProratedMonths;

    const currencyRate = parseFloat(DOMCache.get('currency-rate')?.value) || 96;
    const fullYearLocalAmount = Math.round(totalFullYear * currencyRate * 100) / 100;
    const proratedLocalAmount = Math.round(totalProrated * currencyRate * 100) / 100;
    const baseLocalAmount = fullYearLocalAmount + proratedLocalAmount;

    const taxOnLocalAnnualDues = Math.round((fullYearLocalAmount * taxPercentage) / 100 * 100) / 100;
    const taxOnLocalProratedDues = Math.round((proratedLocalAmount * taxPercentage) / 100 * 100) / 100;
    const taxLocalAmount = taxOnLocalAnnualDues + taxOnLocalProratedDues;
    const totalLocalAmount = baseLocalAmount + taxLocalAmount;

    const baseInvoiceAmountLocalEl = document.getElementById('base-invoice-amount-local');
    const totalInvoiceAmountLocalEl = document.getElementById('total-invoice-amount-local');
    const taxBreakdownLocalEl = document.getElementById('tax-breakdown-local');
    const duesBreakdownLocalEl = document.getElementById('dues-breakdown-local');

    if (baseInvoiceAmountLocalEl) baseInvoiceAmountLocalEl.textContent = `${baseLocalAmount.toFixed(2)}`;
    if (totalInvoiceAmountLocalEl) totalInvoiceAmountLocalEl.textContent = `${totalLocalAmount.toFixed(2)}`;
    if (taxBreakdownLocalEl) taxBreakdownLocalEl.textContent = `Tax: ${taxOnLocalAnnualDues.toFixed(2)} + ${taxOnLocalProratedDues.toFixed(2)} (${taxPercentage}%)`;
    if (duesBreakdownLocalEl) duesBreakdownLocalEl.textContent = `Annual: ${fullYearLocalAmount.toFixed(2)} + Prorated: ${proratedLocalAmount.toFixed(2)}`;

    memberRows.forEach(row => {
        if (row.classList.contains('editing')) return;

        const joinDate = row.dataset.joinDate;
        const leaveDate = normalizeLeaveDateStr(row.dataset.leaveDate);
        const memberType = row.dataset.memberType;
        const duesBreakdown = calculateIndividualDue(joinDate, memberType, selectedYear, leaveDate);

        const localDueCell = row.querySelector('.local-due-cell');
        if (localDueCell) {
            localDueCell.innerHTML = formatLocalDuesBreakdown(duesBreakdown);
        }

        const localDueWithTaxCell = row.querySelector('.local-due-with-tax-cell');
        if (localDueWithTaxCell) {
            localDueWithTaxCell.innerHTML = formatLocalDuesWithTaxBreakdown(duesBreakdown);
        }
    });

    const emptyState = document.getElementById('empty-state');
    if (emptyState) {
        if (memberRows.length === 0) {
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
        }
    }

    const duration = PerformanceMonitor.endTimer('updateTotal');
    PerformanceMonitor.trackUserInteraction('update_total', duration);
}

const debouncedUpdateTotal = debounce(updateTotal, 300);

function recalculateAllDues() {
    try {
        const invoiceYearSelect = document.getElementById('invoice-year-select');
        if (!invoiceYearSelect) {
            return;
        }
        
        const selectedYear = getSelectedInvoiceYear();
        if (isNaN(selectedYear)) {
            return;
        }
        
        const memberRosterBody = document.getElementById('member-roster-body');
        if (!memberRosterBody) {
            return;
        }
        
        const memberRows = memberRosterBody.querySelectorAll('tr');
        
        memberRows.forEach((row, index) => {
            try {
                if (row.classList.contains('editing')) {
                    return;
                }
                
                const joinDate = row.dataset.joinDate;
                const leaveDate = normalizeLeaveDateStr(row.dataset.leaveDate);
                const memberType = row.dataset.memberType;
                
                if (!joinDate || !memberType) {
                    return;
                }
                
                const duesBreakdown = calculateIndividualDue(joinDate, memberType, selectedYear, leaveDate);
                
                row.dataset.due = duesBreakdown.total;
                
                // Update cells with error handling
                const dueCell = row.querySelector('.due-cell');
                const localDueCell = row.querySelector('.local-due-cell');
                const localDueWithTaxCell = row.querySelector('.local-due-with-tax-cell');
                
                if (dueCell) dueCell.innerHTML = formatDuesBreakdown(duesBreakdown);
                if (localDueCell) localDueCell.innerHTML = formatLocalDuesBreakdown(duesBreakdown);
                if (localDueWithTaxCell) localDueWithTaxCell.innerHTML = formatLocalDuesWithTaxBreakdown(duesBreakdown);
                
                const cells = row.querySelectorAll('td');
                if (cells.length >= 9) {
                    cells[7].textContent = duesBreakdown.fullYear > 0 ? 'Yes' : 'No';
                    cells[7].classList.add('active-member-cell');
                    cells[8].textContent = duesBreakdown.proratedMonths || 0;
                    cells[8].classList.add('prorated-months-cell');
                }
                
            } catch (rowError) {
                // Silent error handling for production
            }
        });
        
        updateTotal();
        updateInvoiceDateDisplay();
        
    } catch (error) {
        // Silent error handling for production
    }
}

// Member management functions
function addMember(e) {
    PerformanceMonitor.startTimer('addMember');
    
    if (!formValidator.validateAll()) {
        if (formValidator.errors.size > 1) {
            showErrorMessage(`Please fix ${formValidator.errors.size} validation errors before submitting.`);
        }
        return;
    }
    
    const memberNameInput = DOMCache.get('member-name') || document.getElementById('member-name');
    const memberTypeInput = DOMCache.get('member-type') || document.getElementById('member-type');
    const joinDateInput = DOMCache.get('join-date') || document.getElementById('join-date');
    const leaveDateInput = DOMCache.get('leave-date') || document.getElementById('leave-date');
    const memberRosterBody = DOMCache.get('member-roster-body');
    
    const name = memberNameInput.value.trim();
    const clubBase = memberTypeInput.value;
    const joinDate = joinDateInput.value;
    const leaveDate = leaveDateInput.value;

    const selectedYear = getSelectedInvoiceYear();
    const duesBreakdown = calculateIndividualDue(joinDate, clubBase, selectedYear, leaveDate);
    const memberId = `member-${Date.now()}`;
    const row = document.createElement('tr');
    
    row.id = memberId;
    row.dataset.memberId = memberId; // Add this line
    row.dataset.due = duesBreakdown.total;
    row.dataset.joinDate = joinDate;
    row.dataset.leaveDate = leaveDate || '';
    row.dataset.memberType = clubBase;
    row.dataset.name = name;
    row.classList.add('member-row');
    
    row.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">${name}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${joinDate}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${leaveDate || '-'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">${clubBase}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium due-cell">${formatDuesBreakdown(duesBreakdown)}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium local-due-cell">${formatLocalDuesBreakdown(duesBreakdown)}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium local-due-with-tax-cell">${formatLocalDuesWithTaxBreakdown(duesBreakdown)}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center active-member-cell">${duesBreakdown.fullYear > 0 ? 'Yes' : 'No'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center prorated-months-cell">${duesBreakdown.proratedMonths || 0}</td>
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
    window.allMemberRows.push(row); // Add the row to the allMemberRows array
    allMemberRows = window.allMemberRows;

    // Use event delegation instead of individual event listeners
    // Event listeners are now handled by the EventManager.delegate() in initializeApp()
    
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
    
    // Log user activity if authenticated
    if (window.isAuthenticated && window.currentUser) {
        logUserActivity(window.currentUser.uid, 'add_member');
    }
    
    // End performance monitoring
    const duration = PerformanceMonitor.endTimer('addMember');
    PerformanceMonitor.trackUserInteraction('add_member', duration);
    
}

// Feedback functions
function showSuccessMessage(message, targetElement = null, isWelcomeMessage = false) {
    // Check if this is a welcome message and show in dedicated area
    if (isWelcomeMessage || message.toLowerCase().includes('welcome')) {
        showWelcomeMessage(message);
        return;
    }
    
    const successDiv = document.createElement('div');
    successDiv.className = 'success-feedback fade-in';
    const sanitizedMessage = SecurityUtils.sanitizeText(message);
    successDiv.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>${sanitizedMessage}</span>
    `;
    
    // If target element is provided, show message near that element
    if (targetElement) {
        targetElement.parentNode.insertBefore(successDiv, targetElement.nextSibling);
    } else {
        // Default behavior - show near add member form
        const addMemberForm = document.getElementById('add-member-form');
        addMemberForm.parentNode.insertBefore(successDiv, addMemberForm.nextSibling);
    }
    
    setTimeout(() => {
        successDiv.remove();
    }, 3000);
}

function showWelcomeMessage(message) {
    const welcomeArea = document.getElementById('welcome-message-area');
    if (!welcomeArea) return;
    
    // Update the welcome message content
    const messageElement = welcomeArea.querySelector('p');
    if (messageElement) {
        messageElement.textContent = SecurityUtils.sanitizeText(message);
    }
    
    // Show the welcome area
    welcomeArea.classList.remove('hidden');
    
    // Add dismiss functionality
    const dismissButton = document.getElementById('dismiss-welcome');
    if (dismissButton) {
        dismissButton.onclick = () => {
            welcomeArea.classList.add('hidden');
        };
    }
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        welcomeArea.classList.add('hidden');
    }, 5000);
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
    
    // Log file upload error activity
    if (window.isAuthenticated && window.currentUser && window.appFunctions && window.appFunctions.logUserActivity) {
        window.appFunctions.logUserActivity(window.currentUser.uid, 'file_upload_error');
    }
    
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
    if (appInitialized) return;
    appInitialized = true;

    PerformanceMonitor.startTimer('initializeApp');
    
    // Initialize DOM cache
    DOMCache.initialize();
    
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
    
    const joinDateInput = DOMCache.get('join-date') || document.getElementById('join-date');
    const currentYearSpan = document.getElementById('current-year');
    
    if (joinDateInput) joinDateInput.value = todayFormatted;
    if (currentYearSpan) currentYearSpan.textContent = yyyy;
    
    // Initialize form validation
    const memberNameInput = DOMCache.get('member-name') || document.getElementById('member-name');
    const memberTypeInput = DOMCache.get('member-type') || document.getElementById('member-type');
    const joinDateInput2 = DOMCache.get('join-date') || document.getElementById('join-date');
    const leaveDateInput = DOMCache.get('leave-date') || document.getElementById('leave-date');
    
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

    const rosterSearchInput = document.getElementById('roster-search-input');
    const rosterSearchClear = document.getElementById('roster-search-clear');
    const debouncedRosterSearch = debounce((value) => setRosterSearch(value), 200);

    if (rosterSearchInput) {
        rosterSearchInput.addEventListener('input', (e) => {
            debouncedRosterSearch(e.target.value);
        });
        rosterSearchInput.addEventListener('search', (e) => {
            setRosterSearch(e.target.value);
        });
    }

    if (rosterSearchClear) {
        rosterSearchClear.addEventListener('click', () => {
            clearRosterSearch();
            updatePagination();
        });
    }
    
    // Add event listeners for calculation triggers
    const taxPercentageInput = DOMCache.get('tax-percentage');
    const currencyRateInput = DOMCache.get('currency-rate');
    
    if (taxPercentageInput) {
        taxPercentageInput.addEventListener('input', debouncedUpdateTotal);
        taxPercentageInput.addEventListener('change', updateTotal);
    }
    
    if (currencyRateInput) {
        currencyRateInput.addEventListener('input', debouncedUpdateTotal);
        currencyRateInput.addEventListener('change', updateTotal);
    }
    
    // Create debounced version of recalculateAllDues for better performance
    const debouncedRecalculateAllDues = debounce(recalculateAllDues, 300);
    
    // Initialize Firebase Authentication (handled in HTML)
    // initializeFirebaseAuth();
    setupManualSave();
    
    // Setup event delegation for member roster
    const memberRosterBody = DOMCache.get('member-roster-body');
    if (memberRosterBody) {
        EventManager.delegate(memberRosterBody, '.edit-member-btn', 'click', (e, target) => {
            e.preventDefault();
            e.stopPropagation();
            const row = target.closest('tr');
            if (row) {
                editMember(row.id);
            }
        });
        
        EventManager.delegate(memberRosterBody, '.remove-member-btn', 'click', (e, target) => {
            e.preventDefault();
            e.stopPropagation();
            const row = target.closest('tr');
            if (row) {
                // Log member delete activity if authenticated
                if (window.isAuthenticated && window.currentUser && window.appFunctions && window.appFunctions.logUserActivity) {
                    window.appFunctions.logUserActivity(window.currentUser.uid, 'delete_member');
                }
                
                // Remove from DOM
                row.remove();
                // Remove from allMemberRows array
                const index = window.allMemberRows.indexOf(row);
                if (index > -1) {
                    window.allMemberRows.splice(index, 1);
                    allMemberRows = window.allMemberRows;
                }
                updateTotal();
                updatePagination();
                
            }
        });
    }
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            const activeElement = document.activeElement;
            if (activeElement && activeElement.closest('#add-member-form')) {
                const addMemberForm = DOMCache.get('add-member-form');
                if (addMemberForm) {
                    addMemberForm.dispatchEvent(new Event('submit'));
                }
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
        const duration = PerformanceMonitor.endTimer('initializeApp');
        PerformanceMonitor.trackUserInteraction('app_initialized', duration);
    });
}

// Prefer shared modules if present (behavior-preserving overrides)
try {
	if (window.DuesCalculator && typeof window.DuesCalculator.calculateIndividualDue === 'function') {
		calculateIndividualDue = window.DuesCalculator.calculateIndividualDue;
	}
	if (window.DuesFormatter) {
		if (typeof window.DuesFormatter.formatUSD === 'function') {
			formatDuesBreakdown = window.DuesFormatter.formatUSD;
		}
		if (typeof window.DuesFormatter.formatLocal === 'function') {
			formatLocalDuesBreakdown = function(duesBreakdown) {
				const currencyRate = parseFloat(document.getElementById('currency-rate')?.value) || 96;
				return window.DuesFormatter.formatLocal(duesBreakdown, currencyRate);
			};
		}
		if (typeof window.DuesFormatter.formatLocalWithTax === 'function') {
			formatLocalDuesWithTaxBreakdown = function(duesBreakdown) {
				const currencyRate = parseFloat(document.getElementById('currency-rate')?.value) || 96;
				const taxPercentage = parseFloat(document.getElementById('tax-percentage')?.value) || 0;
				return window.DuesFormatter.formatLocalWithTax(duesBreakdown, currencyRate, taxPercentage);
			};
		}
	}
} catch (e) {
	// Safe no-op if overrides fail
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
    handleGoogleSheetsImport,
    confirmBulkSheetPicker,
    cancelBulkSheetPicker,
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

async function parseExcelFile(file, sheetName = null) {
    const workbook = await readExcelWorkbookFromFile(file);
    if (!sheetName && workbook.SheetNames.length > 1) {
        return { needsSheetSelection: true, sheetNames: workbook.SheetNames.slice(), workbook };
    }
    const selectedSheet = sheetName || workbook.SheetNames[0];
    return rowsFromExcelWorkbook(workbook, selectedSheet);
}

async function readExcelWorkbookFromFile(file) {
    await ensureXLSXLoaded();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                resolve(workbook);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function rowsFromExcelWorkbook(workbook, sheetName) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
        throw new Error(`Worksheet "${sheetName}" not found.`);
    }
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: '' });
    return prepareBulkDataRows(jsonData);
}

async function parseCSVFile(file) {
    await ensurePapaLoaded();
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            complete: function(results) {
                if (results.errors.length > 0) {
                    reject(new Error('CSV parsing error: ' + results.errors[0].message));
                    return;
                }
                resolve(prepareBulkDataRows(results.data));
            },
            error: function(error) {
                reject(error);
            }
        });
    });
}

// Bulk import pipeline:
// 1. parse file → 2. row 0 = column headers, row 1+ = members → 3. validate → 4. preview → 5. add

function stripBulkCellText(value) {
    return String(value ?? '').replace(/^\uFEFF/, '').trim();
}

function normalizeHeaderLabel(value) {
    return stripBulkCellText(value).toLowerCase().replace(/\s+/g, ' ');
}

function headerAliasMatches(label, alias) {
    if (!label || !alias) return false;
    return label === alias || (alias.length >= 4 && label.includes(alias));
}

function buildBulkColumnIndex(headerRow) {
    if (!headerRow || !headerRow.length) return null;

    const labels = headerRow.map(normalizeHeaderLabel);
    const mapping = {};
    let matched = 0;

    for (const [field, aliases] of Object.entries(BULK_COLUMN_HEADERS)) {
        const idx = labels.findIndex((label) =>
            aliases.some((alias) => headerAliasMatches(label, alias))
        );
        if (idx >= 0) {
            mapping[field] = idx;
            matched++;
        }
    }

    if (
        matched >= 3 &&
        mapping.name !== undefined &&
        mapping.joinDate !== undefined &&
        mapping.clubBase !== undefined
    ) {
        return mapping;
    }

    return null;
}

function isBulkHeaderLabel(value) {
    return BULK_HEADER_LABELS.has(normalizeHeaderLabel(value));
}

function shouldSkipBulkRow(row) {
    const mapping = buildBulkColumnIndex(row);
    if (!mapping) {
        return false;
    }

    const nameCell = stripBulkCellText(row[mapping.name]);
    const joinCell = row[mapping.joinDate];
    const clubCell = row[mapping.clubBase];

    if (isBulkHeaderLabel(nameCell)) {
        return true;
    }

    // Real member rows have a date in the join column and a club-base value.
    if (SecurityUtils.validateDate(normalizeBulkDate(joinCell)) || isRecognizedClubBase(clubCell)) {
        return false;
    }

    return isBulkHeaderLabel(joinCell);
}

function normalizeBulkRowWidths(rows) {
    const maxCols = rows.reduce(
        (max, row) => Math.max(max, Array.isArray(row) ? row.length : 0),
        0
    );
    return rows.map((row) => {
        const source = Array.isArray(row) ? row : [];
        const padded = source.slice();
        while (padded.length < maxCols) {
            padded.push('');
        }
        return padded;
    });
}

function isRecognizedClubBase(value) {
    const normalized = normalizeClubBase(value);
    return normalized === 'Community-Based' || normalized === 'University-Based';
}

function extractBulkRowFields(row, columnIndex) {
    const safeRow = Array.isArray(row) ? row : [];

    let name = safeRow[columnIndex.name];
    let joinDate = safeRow[columnIndex.joinDate];
    let clubBase = safeRow[columnIndex.clubBase];
    let leaveDate = columnIndex.leaveDate !== undefined ? safeRow[columnIndex.leaveDate] : undefined;

    const leaveIdx = columnIndex.leaveDate;
    const clubIdx = columnIndex.clubBase;

    // Sparse CSV rows: active members may omit a blank leave-date cell (3 cols vs 4).
    if (
        leaveIdx !== undefined &&
        clubIdx !== undefined &&
        leaveIdx < clubIdx &&
        !stripBulkCellText(clubBase) &&
        stripBulkCellText(leaveDate)
    ) {
        const normalizedLeave = normalizeBulkLeaveDate(leaveDate);
        if (
            (!normalizedLeave && isRecognizedClubBase(leaveDate)) ||
            (!SecurityUtils.validateDate(normalizedLeave) && isRecognizedClubBase(leaveDate))
        ) {
            clubBase = leaveDate;
            leaveDate = undefined;
        }
    } else if (
        leaveIdx !== undefined &&
        clubIdx !== undefined &&
        clubIdx < leaveIdx &&
        isRecognizedClubBase(leaveDate) &&
        stripBulkCellText(clubBase) &&
        SecurityUtils.validateDate(normalizeBulkDate(clubBase))
    ) {
        const actualLeave = clubBase;
        clubBase = leaveDate;
        leaveDate = actualLeave;
    }

    return { name, joinDate, clubBase, leaveDate };
}

function rowHasBulkData(row) {
    return row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== '');
}

function prepareBulkDataRows(rows) {
    if (!rows || rows.length === 0) {
        return { rows: [], columnIndex: { ...DEFAULT_BULK_COLUMN_INDEX } };
    }

    const paddedRows = normalizeBulkRowWidths(rows);
    const columnIndex = buildBulkColumnIndex(paddedRows[0]) || { ...DEFAULT_BULK_COLUMN_INDEX };
    const dataRows = paddedRows.slice(1).filter(rowHasBulkData);
    return { rows: dataRows, columnIndex };
}

function normalizeClubBase(value) {
    const str = String(value || '').trim();
    if (!str) return '';
    if (str === 'Community-Based' || str === 'University-Based') return str;

    const lower = str.toLowerCase().replace(/\s+/g, ' ').replace(/_/g, '-');
    if (lower.includes('community')) return 'Community-Based';
    if (lower.includes('university') || lower === 'uni' || lower.includes('uni-')) return 'University-Based';
    return str;
}

function normalizeBulkLeaveDate(value) {
    if (value === null || value === undefined) return '';
    const str = String(value).trim();
    if (!str) return '';

    const lower = str.toLowerCase();
    if (['active', 'n/a', 'na', '-', 'none', 'present', 'current'].includes(lower)) {
        return '';
    }

    return normalizeBulkDate(value);
}

function normalizeBulkDate(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number' && !isNaN(value)) {
        const utcDays = Math.floor(value - 25569);
        const date = new Date(utcDays * 86400000);
        if (isNaN(date.getTime())) return String(value);
        const y = date.getUTCFullYear();
        const m = String(date.getUTCMonth() + 1).padStart(2, '0');
        const d = String(date.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    const str = String(value).trim();
    if (!str) return '';

    const numericMatch = str.match(/^(\d+)(?:\.0+)?$/);
    if (numericMatch) {
        const serial = Number(numericMatch[1]);
        if (serial > 20000 && serial < 100000) {
            return normalizeBulkDate(serial);
        }
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

    const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
        const month = slashMatch[1].padStart(2, '0');
        const day = slashMatch[2].padStart(2, '0');
        const year = slashMatch[3];
        return `${year}-${month}-${day}`;
    }

    const parsed = new Date(str);
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 1900 && parsed.getFullYear() <= 2100) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const d = String(parsed.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    return str;
}

function parseGoogleSheetsUrl(url) {
    const trimmed = url.trim();
    let parsed;
    try {
        parsed = new URL(trimmed);
    } catch (_) {
        throw new Error('Paste a valid Google Sheets link (docs.google.com/spreadsheets/…).');
    }

    if (parsed.hostname !== 'docs.google.com') {
        throw new Error('Paste a valid Google Sheets link (docs.google.com/spreadsheets/…).');
    }

    const pathMatch = parsed.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!pathMatch) {
        throw new Error('Paste a valid Google Sheets link (docs.google.com/spreadsheets/…).');
    }

    const spreadsheetId = pathMatch[1];
    let gid = '0';
    const gidFromHash = parsed.hash.match(/gid=(\d+)/);
    const gidFromQuery = parsed.searchParams.get('gid');
    if (gidFromHash) {
        gid = gidFromHash[1];
    } else if (gidFromQuery) {
        gid = gidFromQuery;
    }

    return { spreadsheetId, gid };
}

async function fetchGoogleSheetRows(sheetUrl) {
    const { spreadsheetId, gid } = parseGoogleSheetsUrl(sheetUrl);
    return fetchGoogleSheetRowsByGid(spreadsheetId, gid);
}

function isMalformedGoogleSheetCsv(rows) {
    if (!rows || rows.length < 2) {
        return false;
    }

    const columnIndex = buildBulkColumnIndex(rows[0]) || { ...DEFAULT_BULK_COLUMN_INDEX };

    for (let i = 1; i < Math.min(rows.length, 4); i++) {
        const row = rows[i];
        if (!row) {
            continue;
        }

        const joinCell = String(row[columnIndex.joinDate] ?? '');
        const joinDates = joinCell.match(/\d{4}-\d{2}-\d{2}/g);

        // gviz CSV without headers=1 collapses many rows into one cell.
        if (joinDates && joinDates.length > 1) {
            return true;
        }
    }

    return false;
}

async function fetchGoogleSheetRowsByGid(spreadsheetId, gid) {
    const exportUrls = [
        `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`,
        `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&headers=1&gid=${gid}`
    ];

    let lastError = null;
    for (const exportUrl of exportUrls) {
        try {
            return await fetchAndParseGoogleSheetCsv(exportUrl);
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('Could not load sheet. Download as CSV and upload instead, or check that sharing is set to "Anyone with the link can view".');
}

async function fetchGoogleSpreadsheetTabs(spreadsheetId) {
    const response = await fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/htmlview`);
    if (!response.ok) {
        throw new Error('Could not access sheet. Set sharing to "Anyone with the link can view".');
    }

    const html = await response.text();
    const tabs = [];
    const regex = /\{name:\s*"((?:\\.|[^"\\])*)"\s*,\s*pageUrl:\s*"[^"]*"\s*,\s*gid:\s*"(\d+)"/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
        tabs.push({
            name: match[1].replace(/\\"/g, '"'),
            gid: match[2]
        });
    }

    if (tabs.length > 0) {
        return tabs;
    }

    return [{ name: 'Sheet1', gid: '0' }];
}

async function fetchAndParseGoogleSheetCsv(exportUrl) {
    const response = await fetch(exportUrl);
    if (!response.ok) {
        throw new Error('Could not access sheet. Set sharing to "Anyone with the link can view".');
    }

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    if (text.trim().startsWith('<!') || contentType.includes('text/html')) {
        throw new Error('Could not access sheet. Set sharing to "Anyone with the link can view".');
    }

    await ensurePapaLoaded();
    return new Promise((resolve, reject) => {
        Papa.parse(text, {
            complete: function(results) {
                if (results.errors.length > 0) {
                    reject(new Error('CSV parsing error: ' + results.errors[0].message));
                    return;
                }
                if (isMalformedGoogleSheetCsv(results.data)) {
                    reject(new Error('Google Sheets returned a malformed export. Retrying…'));
                    return;
                }
                const prepared = prepareBulkDataRows(results.data);
                if (prepared.rows.length === 0) {
                    reject(new Error('No member rows found.'));
                    return;
                }
                resolve(prepared);
            },
            error: function(error) {
                reject(error);
            }
        });
    });
}

function processBulkRows(prepared, options = {}) {
    const dataRows = Array.isArray(prepared) ? prepared : prepared.rows;
    const columnIndex = prepared.columnIndex || options.columnIndex || { ...DEFAULT_BULK_COLUMN_INDEX };
    const validation = validateMemberData(dataRows, columnIndex);

    if (validation.errors.length > 0) {
        window.parsedMembers = [];
        bulkImportActive = false;
        const summary = `${validation.errors.length} row(s) failed validation (${validation.validatedMembers.length} of ${dataRows.length} valid).`;
        const errorMessage = summary + '\n\n' + validation.errors.join('\n');
        showFileUploadError(errorMessage);
        if (typeof options.onError === 'function') {
            options.onError();
        }
        return false;
    }

    if (validation.validatedMembers.length === 0) {
        window.parsedMembers = [];
        bulkImportActive = false;
        showFileUploadError('No valid member rows found. Check the file format and try again.');
        if (typeof options.onError === 'function') {
            options.onError();
        }
        return false;
    }

    window.parsedMembers = validation.validatedMembers;
    showPreview(validation.validatedMembers);
    return true;
}

function getBulkSheetPickerElements(source) {
    const isExcel = source === 'excel';
    return {
        area: document.getElementById(isExcel ? 'file-sheet-picker-area' : 'sheet-picker-area'),
        options: document.getElementById(isExcel ? 'file-sheet-picker-options' : 'sheet-picker-options'),
        radioName: isExcel ? 'file-sheet-picker-choice' : 'sheet-picker-choice'
    };
}

function getActiveBulkSheetPicker() {
    const sheets = getBulkSheetPickerElements('google_sheets');
    if (sheets.area && !sheets.area.classList.contains('hidden')) {
        return { ...sheets, source: 'google_sheets' };
    }
    const excel = getBulkSheetPickerElements('excel');
    if (excel.area && !excel.area.classList.contains('hidden')) {
        return { ...excel, source: 'excel' };
    }
    return null;
}

function getSelectedBulkSheetTab(picker) {
    if (!picker || !picker.options) return null;
    const checked = picker.options.querySelector(`input[name="${picker.radioName}"]:checked`);
    if (!checked) return null;
    const labelEl = checked.closest('label')?.querySelector('span');
    return {
        value: checked.value,
        label: labelEl ? labelEl.textContent.trim() : checked.value
    };
}

function setBulkSheetPickerPrimaryActionVisible(source, visible) {
    if (source === 'google_sheets') {
        const importButton = document.getElementById('sheets-import-button');
        if (importButton) {
            importButton.classList.toggle('hidden', !visible);
        }
    } else if (source === 'excel') {
        const browseButton = document.getElementById('browse-button');
        if (browseButton) {
            browseButton.classList.toggle('hidden', !visible);
        }
    }
}

function hideBulkSheetPickerUI() {
    ['google_sheets', 'excel'].forEach((source) => {
        const { area, options } = getBulkSheetPickerElements(source);
        if (area) area.classList.add('hidden');
        if (options) options.innerHTML = '';
        setBulkSheetPickerPrimaryActionVisible(source, true);
    });
}

function hideBulkSheetPicker() {
    hideBulkSheetPickerUI();
    pendingExcelWorkbook = null;
    pendingGoogleSpreadsheetId = null;
    pendingSheetPickerOptions = null;
}

function showBulkSheetPicker(tabs, options = {}) {
    const source = options.source === 'excel' ? 'excel' : 'google_sheets';
    const { area, options: optionsContainer, radioName } = getBulkSheetPickerElements(source);
    if (!area || !optionsContainer) {
        return false;
    }

    hideBulkSheetPickerUI();
    pendingSheetPickerOptions = options;

    let preferredValue = null;
    if (options.preferredGid !== undefined && options.preferredGid !== null) {
        preferredValue = String(options.preferredGid);
    } else if (options.preferredSheetName) {
        preferredValue = options.preferredSheetName;
    }

    optionsContainer.innerHTML = tabs.map((tab, index) => {
        const value = tab.gid !== undefined && tab.gid !== null ? String(tab.gid) : String(tab.name);
        const label = SecurityUtils.sanitizeHTML(tab.name);
        const safeValue = SecurityUtils.sanitizeHTML(value);
        const checked = preferredValue
            ? value === preferredValue || tab.name === preferredValue
            : index === 0;
        return `
            <label class="flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors hover:bg-green-50/80 has-[:checked]:bg-green-50">
                <input type="radio" name="${radioName}" value="${safeValue}"
                    class="h-4 w-4 shrink-0 text-green-600 border-green-300 focus:ring-green-500"
                    ${checked ? 'checked' : ''}>
                <span class="text-sm text-gray-800">${label}</span>
            </label>
        `;
    }).join('');

    if (source === 'excel') {
        optionsContainer.querySelectorAll('label').forEach((labelEl) => {
            labelEl.classList.remove('hover:bg-green-50/80', 'has-[:checked]:bg-green-50');
            labelEl.classList.add('hover:bg-gray-50', 'has-[:checked]:bg-gray-50');
            const input = labelEl.querySelector('input');
            if (input) {
                input.classList.remove('text-green-600', 'border-green-300', 'focus:ring-green-500');
                input.classList.add('text-gray-700', 'border-gray-300', 'focus:ring-gray-500');
            }
        });
    }

    area.classList.remove('hidden');
    setBulkSheetPickerPrimaryActionVisible(source, false);
    return true;
}

async function confirmBulkSheetPicker() {
    const picker = getActiveBulkSheetPicker();
    const options = pendingSheetPickerOptions || {};
    const selected = getSelectedBulkSheetTab(picker);
    const importGeneration = ++bulkImportGeneration;
    bulkImportActive = true;
    const loadingOverlay = document.getElementById('loading-overlay');

    if (!picker || !selected) return;

    if (loadingOverlay) {
        loadingOverlay.classList.add('active');
    }

    try {
        if (options.source === 'excel' && pendingExcelWorkbook) {
            const prepared = rowsFromExcelWorkbook(pendingExcelWorkbook, selected.label);
            if (importGeneration !== bulkImportGeneration) return;
            window.bulkUploadSource = 'file';
            processBulkRows(prepared, options.callbacks || {});
        } else if (options.source === 'google_sheets' && pendingGoogleSpreadsheetId) {
            const prepared = await fetchGoogleSheetRowsByGid(pendingGoogleSpreadsheetId, selected.value);
            if (importGeneration !== bulkImportGeneration) return;
            window.bulkUploadSource = 'google_sheets';
            processBulkRows(prepared, options.callbacks || {});
        }
    } catch (error) {
        if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
            showFileUploadError('Could not load sheet. Download as CSV and upload instead, or check that sharing is set to "Anyone with the link can view".');
        } else {
            showFileUploadError(error.message);
        }
    } finally {
        hideBulkSheetPicker();
        if (loadingOverlay) {
            loadingOverlay.classList.remove('active');
        }
        if (!window.parsedMembers || window.parsedMembers.length === 0) {
            bulkImportActive = false;
        }
    }
}

function cancelBulkSheetPicker() {
    hideBulkSheetPicker();
    bulkImportActive = false;
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.value = '';
    }
}

async function handleGoogleSheetsImport(url) {
    const loadingOverlay = document.getElementById('loading-overlay');
    const sheetsUrlInput = document.getElementById('sheets-url-input');
    const trimmedUrl = (url || '').trim();
    const importGeneration = ++bulkImportGeneration;
    bulkImportActive = true;

    if (!trimmedUrl) {
        bulkImportActive = false;
        showFileUploadError('Please paste a Google Sheets link.');
        return;
    }

    if (loadingOverlay) {
        loadingOverlay.classList.add('active');
    }

    try {
        const { spreadsheetId, gid } = parseGoogleSheetsUrl(trimmedUrl);
        const tabs = await fetchGoogleSpreadsheetTabs(spreadsheetId);
        if (importGeneration !== bulkImportGeneration) return;

        if (tabs.length > 1) {
            pendingGoogleSpreadsheetId = spreadsheetId;
            showBulkSheetPicker(tabs, {
                source: 'google_sheets',
                preferredGid: gid,
                callbacks: {
                    onError: () => {
                        if (sheetsUrlInput) sheetsUrlInput.value = trimmedUrl;
                    }
                }
            });
            return;
        }

        const selectedGid = tabs[0] ? tabs[0].gid : gid;
        const prepared = await fetchGoogleSheetRowsByGid(spreadsheetId, selectedGid);
        if (importGeneration !== bulkImportGeneration) return;
        window.bulkUploadSource = 'google_sheets';
        processBulkRows(prepared, {
            onError: () => {
                if (sheetsUrlInput) sheetsUrlInput.value = trimmedUrl;
            }
        });
    } catch (error) {
        if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
            showFileUploadError('Could not load sheet. Download as CSV and upload instead, or check that sharing is set to "Anyone with the link can view".');
        } else {
            showFileUploadError(error.message);
        }
    } finally {
        if (loadingOverlay) {
            loadingOverlay.classList.remove('active');
        }
        if (!window.parsedMembers || window.parsedMembers.length === 0) {
            bulkImportActive = false;
        }
    }
}

function validateMemberData(data, columnIndex = DEFAULT_BULK_COLUMN_INDEX) {
    const validatedMembers = [];
    const errors = [];
    const maxErrors = 10;

    data.forEach((row, index) => {
        if (shouldSkipBulkRow(row)) {
            return;
        }

        const { name: rawName, joinDate: rawJoinDate, clubBase: rawMemberType, leaveDate: rawLeaveDate } =
            extractBulkRowFields(row, columnIndex);

        const name = stripBulkCellText(rawName);
        const joinDate = normalizeBulkDate(rawJoinDate);
        const memberType = normalizeClubBase(rawMemberType);
        const leaveDate = stripBulkCellText(rawLeaveDate)
            ? normalizeBulkLeaveDate(rawLeaveDate)
            : '';

        if (!name && !joinDate && !memberType && !leaveDate) {
            return;
        }

        const rowNum = index + 2;

        if (!SecurityUtils.validateMemberName(name)) {
            if (errors.length < maxErrors) {
                errors.push(`Row ${rowNum}: Invalid member name - must be 2-100 characters with only letters, spaces, hyphens, apostrophes, and periods`);
            }
            return;
        }

        if (!SecurityUtils.validateDate(joinDate)) {
            if (errors.length < maxErrors) {
                errors.push(`Row ${rowNum}: Invalid join date format (use YYYY-MM-DD)`);
            }
            return;
        }

        const validTypes = ['Community-Based', 'University-Based'];
        if (!validTypes.includes(memberType)) {
            if (errors.length < maxErrors) {
                errors.push(`Row ${rowNum}: Invalid Club Base (use "Community-Based" or "University-Based")`);
            }
            return;
        }

        if (leaveDate && !SecurityUtils.validateDate(leaveDate)) {
            if (errors.length < maxErrors) {
                errors.push(`Row ${rowNum}: Invalid leave date format (use YYYY-MM-DD or leave blank)`);
            }
            return;
        }

        if (leaveDate) {
            const joinDateObj = new Date(joinDate + 'T00:00:00');
            const leaveDateObj = new Date(leaveDate + 'T00:00:00');
            if (leaveDateObj <= joinDateObj) {
                if (errors.length < maxErrors) {
                    errors.push(`Row ${rowNum}: Leave date must be after join date`);
                }
                return;
            }
        }

        validatedMembers.push({
            name: SecurityUtils.sanitizeText(name),
            joinDate: joinDate,
            clubBase: memberType,
            leaveDate: leaveDate || null
        });
    });

    if (errors.length === maxErrors) {
        errors.push('…additional errors omitted');
    }

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
    const bulkUploadSources = document.getElementById('bulk-upload-sources');
    const uploadPreview = document.getElementById('upload-preview');
    
    const previewHTML = `
        <div class="mb-3 text-sm text-gray-600">${members.length} member(s) ready to import</div>
        ${members.map((member) => {
        const typeText = member.clubBase === 'Community-Based' ? 'Community-Based ($8)' : 'University-Based ($5)';
        const leaveDateText = member.leaveDate ? ` | Left: ${member.leaveDate}` : '';
        const safeName = SecurityUtils.sanitizeHTML(member.name);
        return `
            <div class="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                <div class="flex-1">
                    <span class="font-medium text-gray-800">${safeName}</span>
                    <span class="text-gray-500 ml-3">${member.joinDate}${leaveDateText}</span>
                    <span class="text-gray-500 ml-3">${typeText}</span>
                </div>
            </div>
        `;
    }).join('')}`;

    previewContent.innerHTML = previewHTML;
    
    // Show the action buttons (Add to Roster and Cancel) - restore them if they were hidden
    const actionButtons = uploadPreview.querySelector('.flex.gap-3.mt-4');
    if (actionButtons) {
        actionButtons.style.display = 'flex';
    }
    
    // Hide upload sources with smooth transition
    if (bulkUploadSources) {
        bulkUploadSources.classList.add('hidden');
    }
    fileUploadArea.classList.add('hidden');
    
    // Show preview after a short delay
    setTimeout(() => {
        uploadPreview.classList.remove('hidden');
    }, 300);
}

function handleFileUpload(file) {
    const importGeneration = ++bulkImportGeneration;
    bulkImportActive = true;
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
        bulkImportActive = false;
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
        bulkImportActive = false;
        if (loadingOverlay) {
            loadingOverlay.classList.remove('active');
        }
        return;
    }

    parsePromise.then(prepared => {
        if (importGeneration !== bulkImportGeneration) return;

        if (prepared.needsSheetSelection) {
            pendingExcelWorkbook = prepared.workbook;
            showBulkSheetPicker(
                prepared.sheetNames.map((name) => ({ name, gid: name })),
                {
                    source: 'excel',
                    callbacks: {
                        onError: () => {
                            fileInput.value = '';
                        }
                    }
                }
            );
            return;
        }

        window.bulkUploadSource = 'file';
        processBulkRows(prepared, {
            onError: () => {
                fileInput.value = '';
            }
        });
    }).catch(error => {
        showFileUploadError('Error parsing file: ' + error.message);
        fileInput.value = '';
        bulkImportActive = false;
    }).finally(() => {
        // Hide loading state
        if (loadingOverlay) {
            loadingOverlay.classList.remove('active');
        }
        if (!window.parsedMembers || window.parsedMembers.length === 0) {
            bulkImportActive = false;
        }
    });
}

function addBulkMembers() {
    PerformanceMonitor.startTimer('addBulkMembers');

    if (bulkAddInProgress) return;
    if (!window.parsedMembers || window.parsedMembers.length === 0) return;

    bulkAddInProgress = true;
    const confirmUploadBtn = document.getElementById('confirm-upload');
    if (confirmUploadBtn) confirmUploadBtn.disabled = true;

    try {
    const membersToAdd = window.parsedMembers.slice();
    window.parsedMembers = [];

    const selectedYear = getSelectedInvoiceYear();
    const memberRosterBody = DOMCache.get('member-roster-body');

    const fragment = document.createDocumentFragment();

    membersToAdd.forEach(member => {
        const leaveDateForCalc = member.leaveDate || null;
        const duesBreakdown = calculateIndividualDue(member.joinDate, member.clubBase, selectedYear, leaveDateForCalc);
        const memberId = `member-${Date.now()}-${Math.random()}`;

        const row = document.createElement('tr');
        row.id = memberId;
        row.dataset.memberId = memberId;
        row.dataset.due = duesBreakdown.total;
        row.dataset.joinDate = member.joinDate;
        row.dataset.leaveDate = member.leaveDate || '';
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
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium local-due-cell">${formatLocalDuesBreakdown(duesBreakdown)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium local-due-with-tax-cell">${formatLocalDuesWithTaxBreakdown(duesBreakdown)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center active-member-cell">${duesBreakdown.fullYear > 0 ? 'Yes' : 'No'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center prorated-months-cell">${duesBreakdown.proratedMonths || 0}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button class="btn btn-secondary btn-sm !p-2 edit-member-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" /></svg>
                </button>
                <button class="btn btn-danger btn-sm !p-2 remove-member-btn">
                     <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd" /></svg>
                </button>
            </td>
        `;
        
        fragment.appendChild(row);
        window.allMemberRows.push(row); // Add this line
        allMemberRows = window.allMemberRows;
    });
    
    // Append all rows at once using DocumentFragment
    memberRosterBody.appendChild(fragment);

    currentPage = 1;

    updateTotal();
    updatePagination();

    if (window.isAuthenticated && window.currentUser) {
        const activityType = window.bulkUploadSource === 'google_sheets' ? 'bulk_upload_sheets' : 'bulk_upload';
        logUserActivity(window.currentUser.uid, activityType);
    }

    const duration = PerformanceMonitor.endTimer('addBulkMembers');
    PerformanceMonitor.trackUserInteraction('bulk_upload', duration);

    showSuccessAnimation(membersToAdd.length);
    bulkImportActive = false;
    } finally {
        bulkAddInProgress = false;
        if (confirmUploadBtn) confirmUploadBtn.disabled = false;
    }
}

function resetBulkUpload() {
    window.parsedMembers = [];
    window.bulkUploadSource = 'file';
    bulkImportActive = false;
    hideBulkSheetPicker();
    const uploadPreview = document.getElementById('upload-preview');
    const fileInput = document.getElementById('file-input');
    const fileUploadArea = document.getElementById('file-upload-area');
    const bulkUploadSources = document.getElementById('bulk-upload-sources');
    const sheetsUrlInput = document.getElementById('sheets-url-input');
    
    uploadPreview.classList.add('hidden');
    fileInput.value = '';
    if (sheetsUrlInput) {
        sheetsUrlInput.value = '';
    }
    
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
        if (bulkUploadSources) {
            bulkUploadSources.classList.remove('hidden');
        }
        fileUploadArea.classList.remove('hidden');
    }, 300);
}

function showSuccessAnimation(addedCount) {
    const previewContent = document.getElementById('preview-content');
    const uploadPreview = document.getElementById('upload-preview');
    const memberCount = typeof addedCount === 'number'
        ? addedCount
        : (window.parsedMembers ? window.parsedMembers.length : 0);
    
    // Replace preview content with success message
    const successHTML = `
        <div class="text-center py-8 success-animation">
            <div class="success-icon mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </div>
            <h3 class="text-lg font-bold text-gray-800 mb-2">Successfully Added!</h3>
            <p class="text-gray-600 mb-4">${memberCount} member(s) have been added to your roster.</p>
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
function normalizeRosterSearchQuery(query) {
    return String(query ?? '').trim().toLowerCase();
}

function memberRowMatchesSearch(row, query) {
    if (!query) {
        return true;
    }

    const haystack = [
        row.dataset.name,
        row.dataset.joinDate,
        row.dataset.leaveDate,
        row.dataset.memberType
    ].filter(Boolean).join(' ').toLowerCase();

    return haystack.includes(query);
}

function getFilteredMemberRows() {
    const query = normalizeRosterSearchQuery(rosterSearchQuery);
    if (!query) {
        return allMemberRows;
    }
    return allMemberRows.filter((row) => memberRowMatchesSearch(row, query));
}

function updateRosterSearchStatus() {
    const statusEl = document.getElementById('roster-search-status');
    const clearBtn = document.getElementById('roster-search-clear');
    const query = normalizeRosterSearchQuery(rosterSearchQuery);
    const filteredCount = getFilteredMemberRows().length;
    const totalCount = allMemberRows.length;

    if (clearBtn) {
        clearBtn.classList.toggle('hidden', !query);
    }

    if (!statusEl) {
        return;
    }

    if (!query) {
        statusEl.classList.add('hidden');
        statusEl.textContent = '';
        return;
    }

    statusEl.classList.remove('hidden');
    if (filteredCount === 0) {
        statusEl.textContent = `No members match "${rosterSearchQuery.trim()}"`;
    } else if (filteredCount < totalCount) {
        statusEl.textContent = `Showing ${filteredCount} of ${totalCount} members`;
    } else {
        statusEl.textContent = `Showing ${filteredCount} members`;
    }
}

function setRosterSearch(query) {
    rosterSearchQuery = query;
    currentPage = 1;
    updateRosterSearchStatus();
    updatePagination();
}

function clearRosterSearch() {
    rosterSearchQuery = '';
    const input = document.getElementById('roster-search-input');
    if (input) {
        input.value = '';
    }
    updateRosterSearchStatus();
}

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

    // Get all member rows - use window.allMemberRows if available, otherwise get from DOM
    if (window.allMemberRows && window.allMemberRows.length > 0) {
        allMemberRows = window.allMemberRows;
    } else {
        allMemberRows = Array.from(memberRosterBody.querySelectorAll('tr.member-row'));
    }

    const filteredRows = getFilteredMemberRows();
    const totalMembers = filteredRows.length;
    const totalPages = Math.max(1, Math.ceil(totalMembers / pageSize) || 1);

    if (currentPage > totalPages) {
        currentPage = totalPages;
    }
    if (currentPage < 1) {
        currentPage = 1;
    }
    
    // Show/hide pagination controls
    if (totalMembers > pageSize) {
        paginationControls.classList.remove('hidden');
    } else if (paginationControls) {
        paginationControls.classList.add('hidden');
    }

    updateRosterSearchStatus();
    
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
    const filteredRows = getFilteredMemberRows();
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;

    allMemberRows.forEach((row) => {
        row.style.display = 'none';
    });

    filteredRows.slice(start, end).forEach((row) => {
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
    const totalPages = Math.ceil(getFilteredMemberRows().length / pageSize);
    if (currentPage < totalPages) {
        goToPage(currentPage + 1);
    }
}

function changePageSize(newSize) {
    pageSize = parseInt(newSize);
    currentPage = 1; // Reset to first page
    updatePagination();
}

// Global flag to prevent duplicate initialization
let yearSelectorInitialized = false;

// Year Selector Functions
function populateYearSelector() {
    const invoiceYearSelect = document.getElementById('invoice-year-select');
    const dropdownMenu = document.getElementById('invoice-year-dropdown');
    
    if (!invoiceYearSelect || !dropdownMenu) {
        return;
    }
    
    // Prevent duplicate initialization
    if (yearSelectorInitialized) {
        return;
    }
    
    // Clear existing options to prevent duplicates
    dropdownMenu.innerHTML = '';
    
    const currentYear = new Date().getFullYear();
    const startInvoiceYear = 2023;
    const endInvoiceYear = currentYear + 25;
    
    for (let year = startInvoiceYear; year <= endInvoiceYear; year++) {
        const option = document.createElement('div');
        option.className = 'dropdown-option';
        option.dataset.value = year;
        option.textContent = year;
        dropdownMenu.appendChild(option);
    }
    
    // Set initial value
    const selectedValue = currentYear + 1;
    invoiceYearSelect.querySelector('.selected-value').textContent = selectedValue;
    updateInvoiceDateDisplay();
    
    // Add event listeners for custom dropdown
    setupCustomDropdown(invoiceYearSelect, dropdownMenu);
    
    // Mark as initialized
    yearSelectorInitialized = true;
}

function setupCustomDropdown(trigger, menu) {
    let isOpen = false;
    
    // Toggle dropdown
    trigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleDropdown();
    });
    
    // Handle option selection
    menu.addEventListener('click', (e) => {
        if (e.target.classList.contains('dropdown-option')) {
            const value = e.target.dataset.value;
            selectOption(value, e.target);
            toggleDropdown();
        }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!trigger.contains(e.target) && !menu.contains(e.target)) {
            closeDropdown();
        }
    });
    
    // Keyboard navigation
    trigger.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleDropdown();
        }
    });
    
    function toggleDropdown() {
        if (isOpen) {
            closeDropdown();
        } else {
            openDropdown();
        }
    }
    
    function openDropdown() {
        isOpen = true;
        trigger.classList.add('active');
        menu.classList.add('open');
        
        // Highlight current selection
        const currentValue = trigger.querySelector('.selected-value').textContent;
        menu.querySelectorAll('.dropdown-option').forEach(option => {
            option.classList.remove('selected');
            if (option.dataset.value === currentValue) {
                option.classList.add('selected');
            }
        });
    }
    
    function closeDropdown() {
        isOpen = false;
        trigger.classList.remove('active');
        menu.classList.remove('open');
    }
    
    function selectOption(value, element) {
        // Update trigger display
        trigger.querySelector('.selected-value').textContent = value;
        
        // Update selected state
        menu.querySelectorAll('.dropdown-option').forEach(option => {
            option.classList.remove('selected');
        });
        element.classList.add('selected');
        
        // Trigger change event
        updateInvoiceDateDisplay();
        recalculateAllDues();
    }
}

// Helper function to get selected year from custom dropdown
function getSelectedInvoiceYear() {
    const invoiceYearSelect = document.getElementById('invoice-year-select');
    if (invoiceYearSelect) {
        const selectedValue = invoiceYearSelect.querySelector('.selected-value');
        return selectedValue ? parseInt(selectedValue.textContent, 10) : new Date().getFullYear() + 1;
    }
    return new Date().getFullYear() + 1;
}

// Helper function to set selected year in custom dropdown
function setSelectedInvoiceYear(year) {
    const invoiceYearSelect = document.getElementById('invoice-year-select');
    if (invoiceYearSelect) {
        const selectedValue = invoiceYearSelect.querySelector('.selected-value');
        if (selectedValue) {
            selectedValue.textContent = year;
            // Update the selected state in dropdown menu
            const dropdownMenu = document.getElementById('invoice-year-dropdown');
            if (dropdownMenu) {
                dropdownMenu.querySelectorAll('.dropdown-option').forEach(option => {
                    option.classList.remove('selected');
                    if (option.dataset.value === year.toString()) {
                        option.classList.add('selected');
                    }
                });
            }
        }
    }
}

function updateInvoiceDateDisplay() {
    const invoiceYearSelect = document.getElementById('invoice-year-select');
    const invoiceDateDisplay = document.getElementById('invoice-date-display');
    
    if (invoiceYearSelect && invoiceDateDisplay) {
        const selectedYear = invoiceYearSelect.querySelector('.selected-value').textContent;
        invoiceDateDisplay.textContent = `Jan 1st, ${selectedYear}`;
    }
}

// Member Management Functions
function editMember(memberId) {
    const row = document.getElementById(memberId);
    if (!row || row.classList.contains('editing')) {
        return;
    }

    document.querySelectorAll('.edit-member-btn').forEach(btn => btn.disabled = true);
    row.classList.add('editing');

    const name = row.dataset.name;
    const joinDate = row.dataset.joinDate;
    const leaveDate = row.dataset.leaveDate;
    const memberType = row.dataset.memberType;

    // Enhanced input fields with better styling and visibility - sanitized to prevent XSS
    const sanitizedName = SecurityUtils.sanitizeText(name);
    const sanitizedJoinDate = SecurityUtils.sanitizeText(joinDate);
    const sanitizedLeaveDate = leaveDate && leaveDate !== 'null' ? SecurityUtils.sanitizeText(leaveDate) : '';
    
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
    row.cells[7].innerHTML = '<span class="text-gray-400 italic">Calculating...</span>';
    row.cells[8].innerHTML = '<span class="text-gray-400 italic">Calculating...</span>';
    row.cells[9].innerHTML = `
        <div class="flex space-x-2">
            <button class="btn btn-primary btn-sm !p-2 save-member-btn" title="Save changes">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>
            </button>
            <button class="btn btn-secondary btn-sm !p-2 cancel-edit-btn" title="Cancel editing">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
            </button>
        </div>
    `;

    // Add event listeners after the HTML is set
    setTimeout(() => {
        const saveBtn = row.querySelector('.save-member-btn');
        const cancelBtn = row.querySelector('.cancel-edit-btn');
        
        if (saveBtn) {
            saveBtn.addEventListener('click', () => saveMember(memberId));
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => cancelEdit(memberId));
        }
    }, 0);
    
    // Auto-focus on the name input for better UX
    setTimeout(() => {
        const nameInput = row.cells[0].querySelector('input');
        if (nameInput) {
            nameInput.focus();
            nameInput.select();
        }
    }, 150);
    
    // Add keyboard support for better UX
    setTimeout(() => {
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
    }, 0);
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

    if (!SecurityUtils.validateDate(newJoinDate)) {
        showErrorMessage('Please enter a valid join date (YYYY-MM-DD)');
        row.cells[1].querySelector('input').focus();
        return;
    }

    if (newLeaveDate && !SecurityUtils.validateDate(newLeaveDate)) {
        showErrorMessage('Please enter a valid leave date (YYYY-MM-DD) or leave blank');
        row.cells[2].querySelector('input').focus();
        return;
    }

    if (newLeaveDate) {
        const joinDateObj = new Date(newJoinDate + 'T00:00:00');
        const leaveDateObj = new Date(newLeaveDate + 'T00:00:00');
        if (leaveDateObj <= joinDateObj) {
            showErrorMessage('Leave date must be after join date');
            row.cells[2].querySelector('input').focus();
            return;
        }
    }

    row.dataset.name = newName;
    row.dataset.joinDate = newJoinDate;
    row.dataset.leaveDate = newLeaveDate || '';
    row.dataset.memberType = newMemberType;

    const selectedYear = getSelectedInvoiceYear();
    const duesBreakdown = calculateIndividualDue(newJoinDate, newMemberType, selectedYear, newLeaveDate);
    row.dataset.due = duesBreakdown.total;

    row.cells[0].textContent = newName;
    row.cells[1].textContent = newJoinDate;
    row.cells[2].textContent = newLeaveDate || '-';
    row.cells[3].textContent = newMemberType;
    row.cells[4].innerHTML = formatDuesBreakdown(duesBreakdown);
    row.cells[4].classList.add('due-cell');
    row.cells[5].innerHTML = formatLocalDuesBreakdown(duesBreakdown);
    row.cells[5].classList.add('local-due-cell');
    row.cells[6].innerHTML = formatLocalDuesWithTaxBreakdown(duesBreakdown);
    row.cells[6].classList.add('local-due-with-tax-cell');
    row.cells[7].textContent = duesBreakdown.fullYear > 0 ? 'Yes' : 'No';
    row.cells[7].classList.add('active-member-cell');
    row.cells[8].textContent = duesBreakdown.proratedMonths || 0;
    row.cells[8].classList.add('prorated-months-cell');
    
    finishEditing(row, memberId);
    recalculateAllDues();
    updatePagination();
    
    // Log member edit activity if authenticated
    if (window.isAuthenticated && window.currentUser && window.appFunctions && window.appFunctions.logUserActivity) {
        window.appFunctions.logUserActivity(window.currentUser.uid, 'edit_member');
    }
    
    
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
    const selectedYear = getSelectedInvoiceYear();
    const duesBreakdown = calculateIndividualDue(joinDate, memberType, selectedYear, leaveDate);

    row.cells[0].textContent = name;
    row.cells[1].textContent = joinDate;
    row.cells[2].textContent = leaveDate || '-';
    row.cells[3].textContent = memberType;
    row.cells[4].innerHTML = formatDuesBreakdown(duesBreakdown);
    row.cells[4].classList.add('due-cell');
    row.cells[5].innerHTML = formatLocalDuesBreakdown(duesBreakdown);
    row.cells[5].classList.add('local-due-cell');
    row.cells[6].innerHTML = formatLocalDuesWithTaxBreakdown(duesBreakdown);
    row.cells[6].classList.add('local-due-with-tax-cell');
    row.cells[7].textContent = duesBreakdown.fullYear > 0 ? 'Yes' : 'No';
    row.cells[7].classList.add('active-member-cell');
    row.cells[8].textContent = duesBreakdown.proratedMonths || 0;
    row.cells[8].classList.add('prorated-months-cell');

    finishEditing(row, memberId);
    updatePagination();
}

function finishEditing(row, memberId) {
    row.classList.remove('editing');
    row.cells[9].innerHTML = `
        <button class="btn btn-secondary btn-sm !p-2 edit-member-btn">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" /></svg>
        </button>
        <button class="btn btn-danger btn-sm !p-2 remove-member-btn">
             <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd" /></svg>
        </button>
    `;

    document.querySelectorAll('.edit-member-btn').forEach(btn => btn.disabled = false);
}

function resetCalculator() {
    const memberRosterBody = document.getElementById('member-roster-body');
    memberRosterBody.innerHTML = '';
    window.allMemberRows = [];
    allMemberRows = window.allMemberRows;
    currentPage = 1;
    clearRosterSearch();
    updateTotal();
    updatePagination();
    
    // Log reset roster activity if authenticated
    if (window.isAuthenticated && window.currentUser && window.appFunctions && window.appFunctions.logUserActivity) {
        window.appFunctions.logUserActivity(window.currentUser.uid, 'reset_roster');
    }
    
}

// Firebase Authentication and Data Storage Functions
function initializeFirebaseAuth() {
    if (!window.firebaseAuth) {
        return;
    }

    // Listen for auth state changes
    window.firebaseOnAuthStateChanged(window.firebaseAuth, async (user) => {
        if (user) {
            // User is signed in - set all authentication state
            currentUser = user;
            window.currentUser = user;
            isAuthenticated = true;
            window.isAuthenticated = true;
            
            // Set Analytics user ID (PII-safe)
            try {
                if (window.firebaseAnalytics && window.firebaseSetUserId) {
                    window.firebaseSetUserId(window.firebaseAnalytics, user.uid);
                }
            } catch (_) { /* ignore */ }
            
            // Update UI immediately
            updateLoginUI(user);
            
            try {
                // Save user's basic information first
                await saveUserBasicInfo(user);
                
                // Load user data with proper error handling
                await loadUserData(user.uid);
                
                // Batch log sign in and data load activities together
                await logUserActivities(user.uid, ['sign_in', 'data_load']);
                
            } catch (error) {
                showErrorMessage('Failed to initialize user data. Please refresh and try again.');
            }
        } else {
            // User is signed out - clear all state
            currentUser = null;
            window.currentUser = null;
            isAuthenticated = false;
            window.isAuthenticated = false;
            
            // Clear Analytics user ID
            try {
                if (window.firebaseAnalytics && window.firebaseSetUserId) {
                    window.firebaseSetUserId(window.firebaseAnalytics, undefined);
                }
            } catch (_) { /* ignore */ }
            
            // Clear any existing data
            window.allMemberRows = [];
            
            // Clear cache on sign out
            DataCache.clear();
            documentExistsCache.clear();
            
            // Update UI
            updateLoginUI(null);
        }
    });
}

function updateLoginUI(user) {

    
    const loginState = document.getElementById('login-state');
    const userState = document.getElementById('user-state');
    const loadingState = document.getElementById('loading-state');
    const userAvatar = document.getElementById('user-avatar');
    const dropdownAvatar = document.getElementById('dropdown-avatar');
    const dropdownName = document.getElementById('dropdown-name');
    const dropdownEmail = document.getElementById('dropdown-email');
    const profileDropdown = document.getElementById('profile-dropdown');
    
    // Ensure save button exists
    let saveButton = document.getElementById('save-button');
    if (!saveButton) {
        // Save button not found, calling setupManualSave...
        setupManualSave();
        saveButton = document.getElementById('save-button');
    }

    if (user) {
        // User is logged in - show user state
        loginState.classList.add('hidden');
        loadingState.classList.add('hidden');
        userState.classList.remove('hidden');
        
        // Update user info in both profile circle and dropdown
        const avatarSrc = user.photoURL || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDEyQzE0LjIwOTEgMTIgMTYgMTAuMjA5MSAxNiA4QzE2IDUuNzkwODYgMTQuMjA5MSA0IDEyIDRDOS43OTA4NiA0IDggNS43OTA4NiA4IDhDOCAxMC4yMDkxIDkuNzkwODYgMTIgMTJaIiBmaWxsPSIjNkI3MjgwIi8+CjxwYXRoIGQ9Ik0xMiAxNEM5LjMzIDE0IDcgMTYuMzMgNyAxOVYyMEgxN1YxOUMxNyAxNi4zMyAxNC42NyAxNCAxMiAxNFoiIGZpbGw9IiM2QjcyODAiLz4KPC9zdmc+';
        
        if (userAvatar) userAvatar.src = avatarSrc;
        if (dropdownAvatar) dropdownAvatar.src = avatarSrc;
        if (dropdownName) dropdownName.textContent = user.displayName || 'User';
        if (dropdownEmail) dropdownEmail.textContent = user.email || '';
        
        // Update save button state
        updateSaveButtonState();
    } else {
        // User is logged out - show login state
        userState.classList.add('hidden');
        loadingState.classList.add('hidden');
        loginState.classList.remove('hidden');
        
        // Hide dropdown if open
        if (profileDropdown) {
            profileDropdown.classList.add('hidden');
            profileDropdown.classList.remove('opacity-100', 'scale-100');
            profileDropdown.classList.add('opacity-0', 'scale-95');
        }
        
        // Update save button state
        updateSaveButtonState();
    }
}

async function handleLogin() {
    try {
        const result = await window.firebaseSignIn(window.firebaseAuth, window.firebaseProvider);
        showSuccessMessage('Successfully logged in!');
    } catch (error) {
        // Login error
        showErrorMessage('Login failed. Please try again.');
    }
}

async function handleLogout() {
    try {
        // Log sign out activity before signing out
        if (window.isAuthenticated && window.currentUser && window.appFunctions && window.appFunctions.logUserActivity) {
            await window.appFunctions.logUserActivity(window.currentUser.uid, 'sign_out');
        }
        
        // Clear cache on logout
        DataCache.clear();
        documentExistsCache.clear();
        
        await window.firebaseSignOut(window.firebaseAuth);
        showSuccessMessage('Successfully logged out!');
    } catch (error) {
        // Logout error
        showErrorMessage('Logout failed. Please try again.');
    }
}

async function logUserActivity(userId, activityType) {
    if (!window.isAuthenticated || !userId || !window.currentUser) {
        return;
    }

    try {
        await CircuitBreaker.execute('firebase', async () => {
            // Get current user data
            const user = window.currentUser;
            const currentTime = new Date().toISOString();
            
            FirebaseAnalyticsChecker.logEvent('user_activity', {
                user_id: userId,
                activity_type: activityType,
                session_id: generateSessionId(),
                // Add more context for better analytics
                activity_context: 'club_invoice_calculator',
                user_email: user.email || 'no_email'
            });

            // Update user's main document with latest login info
            const userDocRef = window.firebaseDoc(window.firebaseDB, 'users', user.uid);
            try {
                await window.firebaseUpdateDoc(userDocRef, {
                    displayName: user.displayName || 'Unknown',
                    email: user.email || 'No email',
                    lastLogin: user.metadata?.lastSignInTime || currentTime,
                    lastUpdated: currentTime
                });
            } catch (error) {
                // Document doesn't exist, create it
                if (error.code === 'not-found') {
                    await window.firebaseSetDoc(userDocRef, {
                        displayName: user.displayName || 'Unknown',
                        email: user.email || 'No email',
                        lastLogin: user.metadata?.lastSignInTime || currentTime,
                        lastUpdated: currentTime,
                        createdAt: currentTime
                    });
                } else {
                    throw error;
                }
            }
        });

    } catch (error) {
        // Handle error gracefully - don't interrupt user experience
        ErrorHandler.handleError(error, 'firebase');
    }
}

async function logUserActivities(userId, activities) {
    if (!window.isAuthenticated || !userId || !window.currentUser || !activities || !Array.isArray(activities) || activities.length === 0) {
        return;
    }

    try {
        await CircuitBreaker.execute('firebase', async () => {
            // Get current user data
            const user = window.currentUser;
            const currentTime = new Date().toISOString();
            
            // Log all activities to analytics
            activities.forEach(activityType => {
                FirebaseAnalyticsChecker.logEvent('user_activity', {
                    user_id: userId,
                    activity_type: activityType,
                    session_id: generateSessionId(),
                    activity_context: 'club_invoice_calculator',
                    user_email: user.email || 'no_email'
                });
            });

            // Update user's main document with latest info (single write for all activities)
            const userDocRef = window.firebaseDoc(window.firebaseDB, 'users', user.uid);
            try {
                await window.firebaseUpdateDoc(userDocRef, {
                    displayName: user.displayName || 'Unknown',
                    email: user.email || 'No email',
                    lastLogin: user.metadata?.lastSignInTime || currentTime,
                    lastUpdated: currentTime
                });
            } catch (error) {
                // Document doesn't exist, create it
                if (error.code === 'not-found') {
                    await window.firebaseSetDoc(userDocRef, {
                        displayName: user.displayName || 'Unknown',
                        email: user.email || 'No email',
                        lastLogin: user.metadata?.lastSignInTime || currentTime,
                        lastUpdated: currentTime,
                        createdAt: currentTime
                    });
                } else {
                    throw error;
                }
            }
        });

    } catch (error) {
        // Handle error gracefully - don't interrupt user experience
        ErrorHandler.handleError(error, 'firebase');
    }
}

function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

async function logInvoiceSummary(userUid, invoiceSummary) {
    if (!window.isAuthenticated || !userUid || !window.currentUser) {
        return;
    }

    try {
        const user = window.currentUser;
        const currentTime = new Date().toISOString();

        const summaryData = {
            id: `summary-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            displayName: user.displayName || 'Unknown',
            email: user.email || 'No email',
            timestamp: currentTime,
            lastUpdated: currentTime,
            activityType: 'invoice_summary',
            sessionId: generateSessionId(),
            userAgent: navigator.userAgent,
            // Summary fields
            invoiceYear: invoiceSummary?.invoiceYear || null,
            taxPercentage: typeof invoiceSummary?.taxPercentage === 'number' ? invoiceSummary.taxPercentage : null,
            currencyRate: typeof invoiceSummary?.currencyRate === 'number' ? invoiceSummary.currencyRate : null,
            totalMembers: typeof invoiceSummary?.totalMembers === 'number' || typeof invoiceSummary?.totalMembers === 'string' ? Number(invoiceSummary.totalMembers) : null,
            totalProratedMonths: typeof invoiceSummary?.totalProratedMonths === 'number' || typeof invoiceSummary?.totalProratedMonths === 'string' ? Number(invoiceSummary.totalProratedMonths) : null,
            totals: {
                baseAmount: typeof invoiceSummary?.baseAmount === 'number' ? invoiceSummary.baseAmount : null,
                taxAmount: typeof invoiceSummary?.taxAmount === 'number' ? invoiceSummary.taxAmount : null,
                totalWithTax: typeof invoiceSummary?.totalWithTax === 'number' ? invoiceSummary.totalWithTax : null,
                totalFullYearAmount: typeof invoiceSummary?.totalFullYearAmount === 'number' ? invoiceSummary.totalFullYearAmount : null,
                totalProratedAmount: typeof invoiceSummary?.totalProratedAmount === 'number' ? invoiceSummary.totalProratedAmount : null,
                baseLocalAmount: typeof invoiceSummary?.baseLocalAmount === 'number' ? invoiceSummary.baseLocalAmount : null,
                taxLocalAmount: typeof invoiceSummary?.taxLocalAmount === 'number' ? invoiceSummary.taxLocalAmount : null,
                totalLocalAmount: typeof invoiceSummary?.totalLocalAmount === 'number' ? invoiceSummary.totalLocalAmount : null,
                fullYearLocalAmount: typeof invoiceSummary?.fullYearLocalAmount === 'number' ? invoiceSummary.fullYearLocalAmount : null,
                proratedLocalAmount: typeof invoiceSummary?.proratedLocalAmount === 'number' ? invoiceSummary.proratedLocalAmount : null
            }
        };

        // Use transaction to atomically read and update invoice summaries
        const userDocRef = window.firebaseDoc(window.firebaseDB, 'users', userUid);
        await window.firebaseRunTransaction(window.firebaseDB, async (transaction) => {
            const userDoc = await transaction.get(userDocRef);
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const existingSummaries = userData.invoiceSummaries || [];
                
                // Add new summary to the array
                existingSummaries.push(summaryData);
                
                // Sort by timestamp (newest first) and keep only last 10
                const sortedSummaries = existingSummaries.sort((a, b) => {
                    const timestampA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                    const timestampB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                    return timestampB - timestampA; // Descending order (newest first)
                });
                
                // Keep only the last 10 summaries
                const recentSummaries = sortedSummaries.slice(0, 10);
                
                // Update the user document with the trimmed invoiceSummaries array
                transaction.update(userDocRef, {
                    invoiceSummaries: recentSummaries,
                    lastUpdated: currentTime
                });
            } else {
                // If user document doesn't exist, create it with the invoice summary
                transaction.set(userDocRef, {
                    invoiceSummaries: [summaryData],
                    lastUpdated: currentTime,
                    created: currentTime
                });
            }
        });

    } catch (error) {
        ErrorHandler.handleError(error, 'firebase');
    }
}


async function saveUserBasicInfo(user) {
    if (!user || !user.uid || !user.email) {
        return;
    }

    try {
        const currentTime = new Date().toISOString();
        
        // Create basic user document with essential information
        const userBasicInfo = {
            displayName: user.displayName || 'Unknown',
            email: user.email || 'No email',
            lastLogin: user.metadata?.lastSignInTime || currentTime,
            lastUpdated: currentTime,
            photoURL: user.photoURL || null,
            uid: user.uid,
            emailVerified: user.emailVerified || false,
            createdAt: user.metadata?.creationTime || currentTime
        };

        // Save to user collection using UID as document ID
        const userDocRef = window.firebaseDoc(window.firebaseDB, 'users', user.uid);
        try {
            await window.firebaseUpdateDoc(userDocRef, {
                displayName: userBasicInfo.displayName,
                email: userBasicInfo.email,
                lastLogin: userBasicInfo.lastLogin,
                lastUpdated: userBasicInfo.lastUpdated,
                photoURL: userBasicInfo.photoURL,
                emailVerified: userBasicInfo.emailVerified
            });
            } catch (error) {
                // Document doesn't exist, create it
                if (error.code === 'not-found') {
                    await window.firebaseSetDoc(userDocRef, userBasicInfo);
                } else {
                    throw error;
                }
            }

    } catch (error) {
        ErrorHandler.handleError(error, 'firebase');
    }
}

async function saveUserData(userUid, data) {
    if (!window.isAuthenticated || !userUid) {
        return;
    }

    if (!data || typeof data !== 'object') {
        return;
    }

    const cleanMemberRoster = [];
    if (data.memberRoster && Array.isArray(data.memberRoster)) {
        data.memberRoster.forEach(member => {
            if (member && typeof member === 'object' && member.id && member.name && member.joinDate && member.memberType) {
                cleanMemberRoster.push({
                    id: String(member.id),
                    name: String(member.name),
                    joinDate: String(member.joinDate),
                    leaveDate: member.leaveDate ? String(member.leaveDate) : '',
                    memberType: String(member.memberType)
                });
            }
        });
    }

    const cleanSettings = {
        taxPercentage: data.settings && typeof data.settings.taxPercentage === 'number' ? data.settings.taxPercentage : 18,
        currencyRate: data.settings && typeof data.settings.currencyRate === 'number' ? data.settings.currencyRate : 96,
        invoiceYear: data.settings && data.settings.invoiceYear ? String(data.settings.invoiceYear) : new Date().getFullYear().toString()
    };

    const user = window.currentUser;
    const currentTime = new Date().toISOString();
    
    const cleanData = {
        displayName: user?.displayName || 'Unknown',
        email: user?.email || 'No email',
        lastLogin: user?.metadata?.lastSignInTime || currentTime,
        lastUpdated: currentTime,
        memberRoster: cleanMemberRoster,
        settings: cleanSettings
    };

    await logUserActivity(user?.uid, 'data_save');

    try {
        const userDocRef = window.firebaseDoc(window.firebaseDB, 'users', userUid);
        
        // Use document existence cache to avoid redundant reads
        if (documentExistsCache.has(userUid)) {
            // Document exists, use updateDoc directly
            try {
                await window.firebaseUpdateDoc(userDocRef, {
                    displayName: cleanData.displayName,
                    email: cleanData.email,
                    lastLogin: cleanData.lastLogin,
                    lastUpdated: cleanData.lastUpdated,
                    memberRoster: cleanData.memberRoster,
                    settings: cleanData.settings
                });
            } catch (error) {
                // Handle case where cache is stale (document was deleted externally)
                if (error.code === 'not-found') {
                    // Cache was stale, remove from cache and create document
                    documentExistsCache.cache.delete(userUid);
                    await window.firebaseSetDoc(userDocRef, cleanData);
                    documentExistsCache.add(userUid);
                } else {
                    throw error;
                }
            }
        } else {
            // Try updateDoc first (cheaper than getDoc + setDoc)
            try {
                await window.firebaseUpdateDoc(userDocRef, {
                    displayName: cleanData.displayName,
                    email: cleanData.email,
                    lastLogin: cleanData.lastLogin,
                    lastUpdated: cleanData.lastUpdated,
                    memberRoster: cleanData.memberRoster,
                    settings: cleanData.settings
                });
                // Document exists, add to cache
                documentExistsCache.add(userUid);
            } catch (error) {
                // Document doesn't exist, create it
                if (error.code === 'not-found') {
                    await window.firebaseSetDoc(userDocRef, cleanData);
                    // Document created, add to cache
                    documentExistsCache.add(userUid);
                } else {
                    throw error;
                }
            }
        }

    } catch (error) {
        showErrorMessage('Failed to save data. Please try again.');
    }
}

async function loadUserData(userUid) {
    if (!window.isAuthenticated || !userUid) {
        return;
    }

    // Check cache first
    const cacheKey = `user_${userUid}`;
    const cachedData = DataCache.get(cacheKey);
    if (cachedData) {
        // Use cached data
        window.allMemberRows = window.allMemberRows || [];
        
        if (cachedData.memberRoster && Array.isArray(cachedData.memberRoster) && cachedData.memberRoster.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
            showDataChoiceDialog(cachedData);
        } else {
            showSuccessMessage('Welcome! You can start adding members and save them to the cloud.', null, true);
        }
        return;
    }

    try {
        // Activity logging is now batched with sign_in in the auth state change handler
        
        // Ensure allMemberRows is initialized
        window.allMemberRows = window.allMemberRows || [];
        
        // Get user document from Firebase using UID as document ID
        const userDocRef = window.firebaseDoc(window.firebaseDB, 'users', userUid);
        const userDoc = await window.firebaseGetDoc(userDocRef);
        
        if (userDoc.exists()) {
            const data = userDoc.data();
            
            // Cache the data
            DataCache.set(cacheKey, data);
            
            // Update document existence cache since we confirmed the document exists
            documentExistsCache.add(userUid);
            
            // Check if there's cloud data to show dialog
            if (data.memberRoster && Array.isArray(data.memberRoster) && data.memberRoster.length > 0) {
                // Add a small delay to ensure UI is ready
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Show choice dialog
                showDataChoiceDialog(data);
            } else {
                showSuccessMessage('Welcome! You can start adding members and save them to the cloud.', null, true);
            }
        } else {
            // Document doesn't exist - this is normal for new users
            showSuccessMessage('Welcome! You can start adding members and save them to the cloud.', null, true);
        }
    } catch (error) {
        ErrorHandler.handleError(error, 'firebase');
        
        if (error.code === 'permission-denied' || error.code === 'unavailable' || error.message.includes('network')) {
            showErrorMessage('Failed to load your data. Please try again.');
        } else {
            showSuccessMessage('Welcome! You can start adding members and save them to the cloud.', null, true);
        }
    }
}

function showDataChoiceDialog(cloudData) {
    if (document.getElementById('data-choice-dialog')) {
        return;
    }

    if (bulkImportActive || bulkAddInProgress) {
        return;
    }

    // Ensure allMemberRows is initialized
    window.allMemberRows = window.allMemberRows || [];
    
    // Get current member count safely
    const currentMemberCount = window.allMemberRows ? window.allMemberRows.length : 0;
    const cloudMemberCount = cloudData && cloudData.memberRoster ? cloudData.memberRoster.length : 0;
    
    const dialog = document.createElement('div');
    dialog.id = 'data-choice-dialog';
    dialog.className = 'fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4';
    dialog.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full transform transition-all duration-300 scale-95 opacity-0" id="dialog-content">
            <!-- Header -->
            <div class="bg-gradient-to-r from-blue-50 to-indigo-50 px-8 py-6 rounded-t-2xl border-b border-blue-100">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <div class="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                            </svg>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold text-gray-900">Choose Your Data</h3>
                            <p class="text-sm text-gray-600">You have data in multiple locations</p>
                        </div>
                    </div>
                    <button id="close-dialog" class="text-gray-400 hover:text-gray-600 transition-colors duration-200 p-2 rounded-full hover:bg-gray-100">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
            
            <!-- Content -->
            <div class="px-8 py-6">
                <p class="text-gray-700 mb-6 leading-relaxed">
                    We found data in your cloud storage and current session. Which would you like to use?
                </p>
                
                <div class="space-y-4">
                    <!-- Current Session Option -->
                    <div id="use-current-data" class="group cursor-pointer border-2 border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200">
                        <div class="flex items-start space-x-4">
                            <div class="w-10 h-10 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div class="flex-1">
                                <div class="flex items-center space-x-2 mb-1">
                                    <h4 class="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">Continue with Current Session</h4>
                                    <span class="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">Current</span>
                                </div>
                                <p class="text-sm text-gray-600 mb-2">Keep your current work and continue where you left off</p>
                                <div class="flex items-center space-x-4 text-xs text-gray-500">
                                    <span class="flex items-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                        ${currentMemberCount} member(s)
                                    </span>
                                    <span class="flex items-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Just now
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Cloud Data Option -->
                    <div id="use-cloud-data" class="group cursor-pointer border-2 border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200">
                        <div class="flex items-start space-x-4">
                            <div class="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                                </svg>
                            </div>
                            <div class="flex-1">
                                <div class="flex items-center space-x-2 mb-1">
                                    <h4 class="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">Load from Cloud</h4>
                                    <span class="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">Cloud</span>
                                </div>
                                <p class="text-sm text-gray-600 mb-2">Restore your previously saved data from the cloud</p>
                                <div class="flex items-center space-x-4 text-xs text-gray-500">
                                    <span class="flex items-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                        ${cloudMemberCount} member(s)
                                    </span>
                                    <span class="flex items-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                        </svg>
                                        Saved
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Footer -->
            <div class="px-8 py-4 bg-gray-50 rounded-b-2xl border-t border-gray-100">
                <div class="flex items-center justify-between">
                    <p class="text-xs text-gray-500">
                        💡 <strong>Tip:</strong> You can always save your current work to the cloud later
                    </p>
                    <button id="cancel-dialog" class="text-gray-500 hover:text-gray-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors duration-200">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Animate in
    setTimeout(() => {
        const content = document.getElementById('dialog-content');
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }, 10);
    
    // Add event listeners
    document.getElementById('use-current-data').addEventListener('click', () => {
        // Log continue with current data activity if authenticated
        if (window.isAuthenticated && window.currentUser && window.appFunctions && window.appFunctions.logUserActivity) {
            window.appFunctions.logUserActivity(window.currentUser.uid, 'continue_current_data');
        }
        
        showPopupFeedback(dialog, 'success', 'Continuing with current session data. Use "Save to Cloud" to backup your changes.');
    });
    
    document.getElementById('use-cloud-data').addEventListener('click', () => {
        // Log cloud load activity if authenticated
        if (window.isAuthenticated && window.currentUser && window.appFunctions && window.appFunctions.logUserActivity) {
            window.appFunctions.logUserActivity(window.currentUser.uid, 'cloud_load');
        }
        
        showPopupFeedback(dialog, 'loading', 'Loading your cloud data...');
        loadCloudData(cloudData);
        setTimeout(() => {
            showPopupFeedback(dialog, 'success', 'Your cloud data has been loaded successfully!');
        }, 500);
    });
    
    document.getElementById('close-dialog').addEventListener('click', () => {
        animateOutAndRemove(dialog);
    });
    
    document.getElementById('cancel-dialog').addEventListener('click', () => {
        animateOutAndRemove(dialog);
    });
    
    // Close on background click
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
            animateOutAndRemove(dialog);
        }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', handleEscapeKey);
    
    function handleEscapeKey(e) {
        if (e.key === 'Escape') {
            document.removeEventListener('keydown', handleEscapeKey);
            animateOutAndRemove(dialog);
        }
    }
}

function showPopupFeedback(dialog, type, message) {
    const content = dialog.querySelector('#dialog-content');
    const originalContent = content.innerHTML;
    
    // Create feedback content
    let feedbackHTML = '';
    if (type === 'loading') {
        feedbackHTML = `
            <div class="text-center py-8">
                <div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
                <h3 class="text-lg font-semibold text-gray-900 mb-2">Loading...</h3>
                <p class="text-gray-600">${message}</p>
            </div>
        `;
    } else if (type === 'success') {
        feedbackHTML = `
            <div class="text-center py-8">
                <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h3 class="text-lg font-semibold text-gray-900 mb-2">Success!</h3>
                <p class="text-gray-600 mb-6">${message}</p>
                <button id="close-popup-btn" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors duration-200">
                    Continue
                </button>
            </div>
        `;
    }
    
    // Replace content with feedback
    content.innerHTML = feedbackHTML;
    
    // Add event listener for close button if it's a success message
    if (type === 'success') {
        setTimeout(() => {
            const closeBtn = document.getElementById('close-popup-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    animateOutAndRemove(dialog);
                });
            }
        }, 100);
    }
    
    // Auto-close success messages after 3 seconds
    if (type === 'success') {
        setTimeout(() => {
            if (dialog.parentNode) {
                animateOutAndRemove(dialog);
            }
        }, 3000);
    }
}



function animateOutAndRemove(dialog, callback = null) {
    const content = dialog.querySelector('#dialog-content');
    content.classList.add('scale-95', 'opacity-0');
    content.classList.remove('scale-100', 'opacity-100');
    
    setTimeout(() => {
        dialog.remove();
        if (callback) callback();
    }, 200);
}

function loadCloudData(data) {
    if (bulkImportActive || bulkAddInProgress) {
        return;
    }

    // Load member roster
    if (data.memberRoster && data.memberRoster.length > 0) {
        loadMemberRoster(data.memberRoster);
    }
    
    // Load settings
    if (data.settings) {
        loadSettings(data.settings);
    }
    
    // Recalculate all dues to ensure PDF generation works correctly
    setTimeout(() => {
        recalculateAllDues();
    }, 200);
    
    // Success message is now handled by the popup feedback
}

function loadMemberRoster(memberRoster) {

    const memberRosterBody = document.getElementById('member-roster-body');
    memberRosterBody.innerHTML = '';
    window.allMemberRows = [];
    allMemberRows = window.allMemberRows;

    memberRoster.forEach(member => {
        const row = document.createElement('tr');
        row.className = 'member-row'; // Add the member-row class for pagination
        row.id = member.id; // Set the row ID
        row.dataset.memberId = member.id;
        row.dataset.name = member.name;
        row.dataset.joinDate = member.joinDate;
        row.dataset.leaveDate = member.leaveDate || '';
        row.dataset.memberType = member.memberType;

        const duesBreakdown = calculateIndividualDue(
            member.joinDate, 
            member.memberType, 
            getSelectedInvoiceYear(),
            member.leaveDate
        );
        
        // Set the due amount in dataset for PDF generation
        row.dataset.due = duesBreakdown.total;

        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-left text-sm text-gray-900">${SecurityUtils.sanitizeHTML(member.name)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">${member.joinDate}</td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">${member.leaveDate || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">${member.memberType}</td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 due-cell">${formatDuesBreakdown(duesBreakdown)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 local-due-cell">${formatLocalDuesBreakdown(duesBreakdown)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 local-due-with-tax-cell">${formatLocalDuesWithTaxBreakdown(duesBreakdown)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 active-member-cell">${duesBreakdown.fullYear > 0 ? 'Yes' : 'No'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 prorated-months-cell">${duesBreakdown.proratedMonths || 0}</td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                <button class="btn btn-secondary btn-sm !p-2 edit-member-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" /></svg>
                </button>
                <button class="btn btn-danger btn-sm !p-2 remove-member-btn">
                     <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd" /></svg>
                </button>
            </td>
        `;

        window.allMemberRows.push(row);
        allMemberRows = window.allMemberRows;
        memberRosterBody.appendChild(row);

    });

    setTimeout(() => {
        updateTotal();
        updatePagination();
    }, 150);
}

function loadSettings(settings) {
    if (settings.taxPercentage) {
        document.getElementById('tax-percentage').value = settings.taxPercentage;
    }
    if (settings.currencyRate) {
        document.getElementById('currency-rate').value = settings.currencyRate;
    }
    if (settings.invoiceYear) {
        setSelectedInvoiceYear(settings.invoiceYear);
    }
}

function getCurrentData() {
    
    const memberRoster = [];
    window.allMemberRows.forEach((row, index) => {
        
        // Only add members with valid data
        const memberId = row.dataset.memberId;
        const name = row.dataset.name;
        const joinDate = row.dataset.joinDate;
        const leaveDate = row.dataset.leaveDate;
        const memberType = row.dataset.memberType;
        

        
        // Skip if essential data is missing
        if (!memberId || !name || !joinDate || !memberType) {
            // Skipping member with missing data
            return;
        }
        
        memberRoster.push({
            id: memberId,
            name: name,
            joinDate: joinDate,
            leaveDate: (leaveDate && leaveDate !== 'null' && leaveDate !== 'undefined') ? leaveDate : '',
            memberType: memberType
        });
    });
    


    const taxPercentageEl = document.getElementById('tax-percentage');
    const currencyRateEl = document.getElementById('currency-rate');

    const settings = {
        taxPercentage: taxPercentageEl ? (parseFloat(taxPercentageEl.value) || 18) : 18,
        currencyRate: currencyRateEl ? (parseFloat(currencyRateEl.value) || 96) : 96,
        invoiceYear: getSelectedInvoiceYear().toString()
    };

    return { memberRoster, settings };
}

// Manual save functionality
function setupManualSave() {
    // Create save button if it doesn't exist
    const resetButton = document.getElementById('reset-button');
    
    if (resetButton && !document.getElementById('save-button')) {
        // Creating save button...
        const saveButton = document.createElement('button');
        saveButton.id = 'save-button';
        saveButton.type = 'button';
        saveButton.className = 'btn text-sm px-4 sm:px-6 py-3 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 whitespace-nowrap';
        saveButton.style.backgroundColor = '#10b981'; // Green background
        saveButton.style.color = 'white'; // White text
        saveButton.style.border = 'none';
        saveButton.style.borderRadius = '0.375rem';
        saveButton.style.fontWeight = '500';
        saveButton.style.cursor = 'pointer';
        
        // Add hover effects
        saveButton.addEventListener('mouseenter', () => {
            saveButton.style.backgroundColor = '#059669'; // Darker green on hover
        });
        saveButton.addEventListener('mouseleave', () => {
            saveButton.style.backgroundColor = '#10b981'; // Original green
        });
        // Set initial content and click handler
        updateSaveButtonState(saveButton);
        
        saveButton.style.display = 'inline-flex'; // Always visible now
        
        // Insert into the button container (next to reset button)
        resetButton.parentNode.appendChild(saveButton);
    } else {
        // Save button already exists or reset button not found
    }
}

function handleManualSave() {
    if (!window.isAuthenticated || !window.currentUser) {
        showErrorMessage('Please sign in to save your data to the cloud.');
        return;
    }
    
    try {
        debouncedSaveUserData(window.currentUser.uid);
        
        // Show immediate feedback
        const saveButton = document.getElementById('save-button');
        showSuccessMessage('Saving to cloud...', saveButton);
    } catch (error) {
        // Error saving data
        showErrorMessage('Failed to save data to cloud. Please try again.');
    }
}

function updateSaveButtonState(saveButton = null) {
    const button = saveButton || document.getElementById('save-button');
    if (!button) return;
    
    if (window.isAuthenticated && window.currentUser) {
        // User is logged in - show "Save to Cloud"
        button.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span class="hidden sm:inline">Save to Cloud</span>
            <span class="sm:hidden">Save</span>
        `;
        button.style.backgroundColor = '#10b981'; // Green
        button.onclick = handleManualSave;
        
        // Update hover effects for save functionality
        button.onmouseenter = () => {
            button.style.backgroundColor = '#059669'; // Darker green
        };
        button.onmouseleave = () => {
            button.style.backgroundColor = '#10b981'; // Original green
        };
    } else {
        // User is not logged in - show "Login to Save"
        button.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span class="hidden sm:inline">Sign in to Save</span>
            <span class="sm:hidden">Sign in</span>
        `;
        button.style.backgroundColor = '#3b82f6'; // Blue
        button.onclick = handleLoginToSave;
        
        // Update hover effects for login functionality
        button.onmouseenter = () => {
            button.style.backgroundColor = '#2563eb'; // Darker blue
        };
        button.onmouseleave = () => {
            button.style.backgroundColor = '#3b82f6'; // Original blue
        };
    }
}

function handleLoginToSave() {
    // Trigger the login process by clicking the login state
    const loginState = document.getElementById('login-state');
    if (loginState) {
        loginState.click();
    } else {
        // Login state not found
        alert('Please use the sign in button in the top right to sign in.');
    }
}

// Cleanup function to prevent memory leaks
function cleanup() {
    // Clear DOM cache
    DOMCache.clear();
    
    // Cleanup event delegation
    EventManager.cleanup();
    
    // Clear performance metrics
    PerformanceMonitor.metrics.clear();
    
    // Reset circuit breaker
    CircuitBreaker.failures.clear();
    CircuitBreaker.thresholds.clear();
    
    // Clear global arrays
    window.allMemberRows = [];
    allMemberRows = [];
    window.parsedMembers = [];
    
    // Clear timeouts
    if (currentErrorTimeout) {
        clearTimeout(currentErrorTimeout);
        currentErrorTimeout = null;
    }
}



// Firebase Analytics Status Checker
const FirebaseAnalyticsChecker = {
    isAvailable() {
        return !!(window.firebaseAnalytics && window.firebaseLogEvent);
    },
    
    async testConnection() {
        if (!this.isAvailable()) {
            return { available: false, reason: 'Firebase Analytics not initialized' };
        }
        
        try {
            await window.firebaseLogEvent(window.firebaseAnalytics, 'test_connection', {
                timestamp: Date.now()
            });
            return { available: true };
        } catch (error) {
            return { 
                available: false, 
                reason: error.message,
                error: error
            };
        }
    },
    
    logEvent(eventName, parameters = {}) {
        if (!this.isAvailable()) {
            return false;
        }
        
        try {
            // Firebase Analytics has specific parameter requirements
            // Custom parameters should be prefixed with 'custom_' for better visibility
            const analyticsParams = {
                // Standard parameters that Firebase Analytics recognizes
                event_category: 'user_activity',
                event_label: parameters.activity_type || 'unknown',
                
                // Custom parameters with proper naming
                custom_user_id: parameters.user_id || 'anonymous',
                custom_activity_type: parameters.activity_type || 'unknown',
                custom_session_id: parameters.session_id || 'no_session',
                custom_timestamp: Date.now(),
                
                // Include original parameters for backward compatibility
                ...parameters
            };
            
            window.firebaseLogEvent(window.firebaseAnalytics, eventName, analyticsParams);
            return true;
        } catch (error) {
            return false;
        }
    }
};

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
    handleGoogleSheetsImport,
    confirmBulkSheetPicker,
    cancelBulkSheetPicker,
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
    resetCalculator,
    clearSessionRoster,
    initializeFirebaseAuth,
    handleLogin,
    handleLogout,
    saveUserData,
    loadUserData,
    logUserActivity,
    logUserActivities,
    logInvoiceSummary,
    saveUserBasicInfo,
    setupManualSave,
    handleManualSave,
    updateSaveButtonState,
    handleLoginToSave,
    cleanup,
    PerformanceMonitor,
    ErrorHandler,
    CircuitBreaker,
    FirebaseAnalyticsChecker
}; 