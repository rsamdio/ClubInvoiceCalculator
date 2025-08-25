// ============================================================================
// ROTARACT CLUB INVOICE CALCULATOR - PERFORMANCE OPTIMIZED VERSION
// ============================================================================

// Performance optimization: Use requestIdleCallback for non-critical operations
const requestIdleCallback = window.requestIdleCallback || ((cb) => setTimeout(cb, 1));

// ============================================================================
// CORE UTILITIES & SECURITY
// ============================================================================

const SecurityUtils = {
    sanitizeHTML: function(str) {
        if (typeof str !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
    
    sanitizeText: function(str) {
        if (typeof str !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.textContent || div.innerText || '';
    },
    
    validateFile: function(file) {
        const allowedTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'text/csv',
            'application/csv'
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
    
    validateDate: function(dateString) {
        if (!dateString || typeof dateString !== 'string') return false;
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateString)) return false;
        
        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date) && date.getFullYear() >= 1900 && date.getFullYear() <= 2100;
    },
    
    validateMemberName: function(name) {
        if (!name || typeof name !== 'string') return false;
        const sanitizedName = this.sanitizeText(name).trim();
        return sanitizedName.length >= 2 && sanitizedName.length <= 100 && /^[a-zA-Z\s\-'\.]+$/.test(sanitizedName);
    }
};

// ============================================================================
// PERFORMANCE OPTIMIZATION SYSTEMS
// ============================================================================

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
            'currency-rate',
            'base-invoice-amount-local',
            'total-invoice-amount-local',
            'tax-breakdown-local',
            'dues-breakdown-local'
        ];
        
        criticalElements.forEach(id => this.get(id));
    }
};

// Event Delegation Manager
const EventManager = {
    handlers: new Map(),
    
    delegate(container, selector, eventType, handler) {
        const key = `${container.id}-${eventType}`;
        
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
    
    removeDelegation(container, eventType) {
        const key = `${container.id}-${eventType}`;
        const handler = this.handlers.get(key);
        if (handler) {
            container.removeEventListener(eventType, handler);
            this.handlers.delete(key);
        }
    },
    
    cleanup() {
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
            
            // Log performance metrics in development
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.log(`Performance: ${name} took ${duration.toFixed(2)}ms`);
            }
            
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
    }
};

// Memory Management
const MemoryManager = {
    cleanup() {
        // Clear DOM cache periodically
        DOMCache.clear();
        
        // Reinitialize critical elements
        DOMCache.initialize();
        
        // Force garbage collection if available
        if (window.gc) {
            window.gc();
        }
    },
    
    // Monitor memory usage
    getMemoryUsage() {
        if (performance.memory) {
            return {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            };
        }
        return null;
    }
};

// ============================================================================
// OPTIMIZED CALCULATION ENGINE
// ============================================================================

// Calculation cache for performance
const CalculationCache = {
    cache: new Map(),
    
    getKey(joinDate, clubBase, invoiceYear, leaveDate) {
        return `${joinDate}-${clubBase}-${invoiceYear}-${leaveDate || 'null'}`;
    },
    
    get(joinDate, clubBase, invoiceYear, leaveDate) {
        const key = this.getKey(joinDate, clubBase, invoiceYear, leaveDate);
        return this.cache.get(key);
    },
    
    set(joinDate, clubBase, invoiceYear, leaveDate, result) {
        const key = this.getKey(joinDate, clubBase, invoiceYear, leaveDate);
        this.cache.set(key, result);
        
        // Limit cache size to prevent memory leaks
        if (this.cache.size > 1000) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
    },
    
    clear() {
        this.cache.clear();
    }
};

// Optimized calculation function with caching
function calculateIndividualDue(joinDateStr, clubBase, invoiceYear, leaveDateStr = null) {
    // Check cache first
    const cached = CalculationCache.get(joinDateStr, clubBase, invoiceYear, leaveDateStr);
    if (cached) {
        return cached;
    }
    
    const joinDate = new Date(joinDateStr + 'T00:00:00');
    const invoiceDate = new Date(invoiceYear, 0, 1);
    const baseDues = clubBase === 'Community-Based' ? 8 : 5;
    const joinYear = joinDate.getFullYear();
    
    // Calculate prorated due per month (rounded to 2 decimals)
    const proratedDuePerMonth = Math.round((baseDues / 12) * 100) / 100;

    let result;

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
        if (leaveDateStr && leaveDateStr.trim() !== '') {
            const leaveDate = new Date(leaveDateStr + 'T00:00:00');
            if (leaveDate < invoiceDate) {
                const leaveMonth = leaveDate.getMonth();
                const leaveDay = leaveDate.getDate();
                
                let effectiveLeaveMonth = leaveMonth;
                effectiveLeaveMonth = Math.max(effectiveLeaveMonth, effectiveJoinMonth);
                
                if (effectiveLeaveMonth < effectiveJoinMonth) {
                    result = { fullYear: 0, prorated: 0, total: 0, proratedMonths: 0 };
                } else {
                    let actualMonthsInJoinYear = effectiveLeaveMonth - effectiveJoinMonth + 1;
                    actualMonthsInJoinYear = Math.max(0, actualMonthsInJoinYear);
                    proratedDues = Math.round(proratedDuePerMonth * actualMonthsInJoinYear * 100) / 100;
                    result = { fullYear: 0, prorated: proratedDues, total: proratedDues, proratedMonths: actualMonthsInJoinYear };
                }
            } else {
                const total = Math.round((baseDues + proratedDues) * 100) / 100;
                result = { fullYear: baseDues, prorated: proratedDues, total: total, proratedMonths: monthsInJoinYear };
            }
        } else {
            const total = Math.round((baseDues + proratedDues) * 100) / 100;
            result = { fullYear: baseDues, prorated: proratedDues, total: total, proratedMonths: monthsInJoinYear };
        }
    }
    // Handle members who joined in the current invoice year
    else if (joinYear === invoiceYear) {
        result = { fullYear: 0, prorated: 0, total: 0, proratedMonths: 0 };
    }
    // Handle members who joined before the previous year (full year dues)
    else if (joinYear < invoiceYear - 1) {
        // Check if they have a leave date before the invoice year
        if (leaveDateStr && leaveDateStr.trim() !== '') {
            const leaveDate = new Date(leaveDateStr + 'T00:00:00');
            if (leaveDate < invoiceDate) {
                result = { fullYear: 0, prorated: 0, total: 0, proratedMonths: 0 };
            } else {
                result = { fullYear: baseDues, prorated: 0, total: baseDues, proratedMonths: 0 };
            }
        } else {
            result = { fullYear: baseDues, prorated: 0, total: baseDues, proratedMonths: 0 };
        }
    }
    // Default case: no dues
    else {
        result = { fullYear: 0, prorated: 0, total: 0, proratedMonths: 0 };
    }
    
    // Cache the result
    CalculationCache.set(joinDateStr, clubBase, invoiceYear, leaveDateStr, result);
    
    return result;
}

// Optimized formatting functions
function preciseDecimal(value, decimals = 2) {
    return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
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
    const currencyRate = parseFloat(DOMCache.get('currency-rate')?.value) || 87;
    
    if (total === 0) {
        return '<span class="text-gray-400">0.00</span>';
    }
    
    // Calculate local currency amounts with proper rounding
    const fullYearLocal = Math.round(fullYear * currencyRate * 100) / 100;
    const proratedLocal = Math.round(prorated * currencyRate * 100) / 100;
    const totalLocal = fullYearLocal + proratedLocal;
    
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
    const currencyRate = parseFloat(DOMCache.get('currency-rate')?.value) || 87;
    const taxPercentage = parseFloat(DOMCache.get('tax-percentage')?.value) || 0;
    
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

// ============================================================================
// FORM VALIDATION SYSTEM
// ============================================================================

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

    isLeaveDateValid(leaveDate) {
        const joinDate = DOMCache.get('join-date')?.value;
        if (!joinDate) return true;
        
        const leaveDateObj = new Date(leaveDate);
        const joinDateObj = new Date(joinDate);
        return leaveDateObj >= joinDateObj;
    }

    validateField(fieldId) {
        const field = DOMCache.get(fieldId);
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
        const field = DOMCache.get(fieldId);
        const errorElement = DOMCache.get(`${fieldId}-error`);
        
        if (field && errorElement) {
            field.classList.remove('input-success');
            field.classList.add('input-error');
            errorElement.textContent = SecurityUtils.sanitizeText(message);
            errorElement.style.display = 'block';
            this.errors.set(fieldId, message);
        }
    }

    setFieldSuccess(fieldId) {
        const field = DOMCache.get(fieldId);
        const errorElement = DOMCache.get(`${fieldId}-error`);
        
        if (field && errorElement) {
            field.classList.remove('input-error');
            field.classList.add('input-success');
            errorElement.style.display = 'none';
            errorElement.textContent = '';
            this.errors.delete(fieldId);
        }
    }

    clearFieldError(fieldId) {
        const field = DOMCache.get(fieldId);
        const errorElement = DOMCache.get(`${fieldId}-error`);
        
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

// ============================================================================
// UI UPDATE FUNCTIONS (OPTIMIZED)
// ============================================================================

// Debounced update function for performance
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

// Optimized total update function
function updateTotal() {
    PerformanceMonitor.startTimer('updateTotal');
    
    requestIdleCallback(() => {
        let baseTotal = 0;
        let totalFullYear = 0;
        let totalProrated = 0;
        let totalMembersWithFullYear = 0;
        let totalProratedMonths = 0;
        
        const selectedYear = parseInt(DOMCache.get('invoice-year-select')?.value, 10);
        const memberRows = DOMCache.get('member-roster-body')?.querySelectorAll('tr') || [];
        
        // Batch process member rows for better performance
        const processRow = (row) => {
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
        };
        
        // Process rows in chunks to avoid blocking the main thread
        const chunkSize = 50;
        for (let i = 0; i < memberRows.length; i += chunkSize) {
            const chunk = Array.from(memberRows).slice(i, i + chunkSize);
            chunk.forEach(processRow);
        }
        
        const taxPercentage = parseFloat(DOMCache.get('tax-percentage')?.value) || 0;
        
        // Calculate tax separately on annual and prorated dues
        const taxOnAnnualDues = Math.round((totalFullYear * taxPercentage) / 100 * 100) / 100;
        const taxOnProratedDues = Math.round((totalProrated * taxPercentage) / 100 * 100) / 100;
        const taxAmount = taxOnAnnualDues + taxOnProratedDues;
        const totalWithTax = Math.round((baseTotal + taxAmount) * 100) / 100;
        
        // Update display elements using DOM cache
        const updateElement = (id, value) => {
            const element = DOMCache.get(id);
            if (element) element.textContent = value;
        };
        
        updateElement('base-invoice-amount', `$${baseTotal.toFixed(2)}`);
        updateElement('total-invoice-amount', `$${totalWithTax.toFixed(2)}`);
        updateElement('tax-breakdown', `Tax: $${taxOnAnnualDues.toFixed(2)} + $${taxOnProratedDues.toFixed(2)} (${taxPercentage}%)`);
        updateElement('dues-breakdown', `Annual: $${preciseDecimal(totalFullYear).toFixed(2)} + Prorated: $${preciseDecimal(totalProrated).toFixed(2)}`);
        updateElement('total-members', totalMembersWithFullYear);
        updateElement('total-prorated-months', totalProratedMonths);
        
        // Update local currency amounts
        const currencyRate = parseFloat(DOMCache.get('currency-rate')?.value) || 87;
        const fullYearLocalAmount = Math.round(totalFullYear * currencyRate * 100) / 100;
        const proratedLocalAmount = Math.round(totalProrated * currencyRate * 100) / 100;
        const baseLocalAmount = fullYearLocalAmount + proratedLocalAmount;
        
        const taxOnLocalAnnualDues = Math.round((fullYearLocalAmount * taxPercentage) / 100 * 100) / 100;
        const taxOnLocalProratedDues = Math.round((proratedLocalAmount * taxPercentage) / 100 * 100) / 100;
        const taxLocalAmount = taxOnLocalAnnualDues + taxOnLocalProratedDues;
        const totalLocalAmount = baseLocalAmount + taxLocalAmount;
        
        updateElement('base-invoice-amount-local', baseLocalAmount.toFixed(2));
        updateElement('total-invoice-amount-local', totalLocalAmount.toFixed(2));
        updateElement('tax-breakdown-local', `Tax: ${taxOnLocalAnnualDues.toFixed(2)} + ${taxOnLocalProratedDues.toFixed(2)} (${taxPercentage}%)`);
        updateElement('dues-breakdown-local', `Annual: ${fullYearLocalAmount.toFixed(2)} + Prorated: ${proratedLocalAmount.toFixed(2)}`);
        
        // Update local currency cells in member roster (batched)
        const updateLocalCells = () => {
            memberRows.forEach(row => {
                if (row.classList.contains('editing')) return;
                
                const joinDate = row.dataset.joinDate;
                const leaveDate = row.dataset.leaveDate;
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
        };
        
        requestIdleCallback(updateLocalCells);
        
        // Show/hide empty state
        const emptyState = DOMCache.get('empty-state');
        if (emptyState) {
            if (memberRows.length === 0) {
                emptyState.classList.remove('hidden');
            } else {
                emptyState.classList.add('hidden');
            }
        }
        
        PerformanceMonitor.endTimer('updateTotal');
    });
}

const debouncedUpdateTotal = debounce(updateTotal, 300);

// Optimized recalculation function
function recalculateAllDues() {
    PerformanceMonitor.startTimer('recalculateAllDues');
    
    try {
        const selectedYear = parseInt(DOMCache.get('invoice-year-select')?.value, 10);
        if (isNaN(selectedYear)) {
            console.error('Invalid invoice year');
            return;
        }
        
        const memberRosterBody = DOMCache.get('member-roster-body');
        if (!memberRosterBody) {
            console.error('Member roster body not found');
            return;
        }
        
        const memberRows = memberRosterBody.querySelectorAll('tr');
        
        // Process rows in chunks to avoid blocking
        const processRowChunk = (rows, startIndex) => {
            const chunkSize = 20;
            const endIndex = Math.min(startIndex + chunkSize, rows.length);
            
            for (let i = startIndex; i < endIndex; i++) {
                const row = rows[i];
                try {
                    if (row.classList.contains('editing')) continue;
                    
                    const joinDate = row.dataset.joinDate;
                    const leaveDate = row.dataset.leaveDate;
                    const memberType = row.dataset.memberType;
                    
                    if (!joinDate || !memberType) continue;
                    
                    const duesBreakdown = calculateIndividualDue(joinDate, memberType, selectedYear, leaveDate);
                    
                    row.dataset.due = duesBreakdown.total;
                    
                    // Update cells
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
                    console.error('Error recalculating row:', rowError);
                }
            }
            
            // Process next chunk if available
            if (endIndex < rows.length) {
                requestIdleCallback(() => processRowChunk(rows, endIndex));
            } else {
                // All chunks processed, update totals
                updateTotal();
                updateInvoiceDateDisplay();
                PerformanceMonitor.endTimer('recalculateAllDues');
            }
        };
        
        // Start processing chunks
        processRowChunk(Array.from(memberRows), 0);
        
    } catch (error) {
        console.error('Error in recalculateAllDues:', error);
        PerformanceMonitor.endTimer('recalculateAllDues');
    }
}

// ============================================================================
// MEMBER MANAGEMENT FUNCTIONS
// ============================================================================

function addMember(e) {
    PerformanceMonitor.startTimer('addMember');
    
    if (!formValidator.validateAll()) {
        if (formValidator.errors.size > 1) {
            showErrorMessage(`Please fix ${formValidator.errors.size} validation errors before submitting.`);
        }
        return;
    }
    
    const memberNameInput = DOMCache.get('member-name');
    const memberTypeInput = DOMCache.get('member-type');
    const joinDateInput = DOMCache.get('join-date');
    const leaveDateInput = DOMCache.get('leave-date');
    const memberRosterBody = DOMCache.get('member-roster-body');
    
    const name = memberNameInput.value.trim();
    const clubBase = memberTypeInput.value;
    const joinDate = joinDateInput.value;
    const leaveDate = leaveDateInput.value;

    const selectedYear = parseInt(DOMCache.get('invoice-year-select')?.value, 10);
    const duesBreakdown = calculateIndividualDue(joinDate, clubBase, selectedYear, leaveDate);
    const memberId = `member-${Date.now()}`;
    const row = document.createElement('tr');
    
    // Set row data attributes
    row.id = memberId;
    row.dataset.name = name;
    row.dataset.joinDate = joinDate;
    row.dataset.leaveDate = leaveDate;
    row.dataset.memberType = clubBase;
    row.dataset.due = duesBreakdown.total;
    
    // Create row HTML
    row.innerHTML = `
        <td class="px-4 py-3 text-sm text-gray-900">${SecurityUtils.sanitizeHTML(name)}</td>
        <td class="px-4 py-3 text-sm text-gray-900">${clubBase}</td>
        <td class="px-4 py-3 text-sm text-gray-900">${joinDate}</td>
        <td class="px-4 py-3 text-sm text-gray-900">${leaveDate || '-'}</td>
        <td class="px-4 py-3 text-sm text-gray-900 due-cell">${formatDuesBreakdown(duesBreakdown)}</td>
        <td class="px-4 py-3 text-sm text-gray-900 local-due-cell">${formatLocalDuesBreakdown(duesBreakdown)}</td>
        <td class="px-4 py-3 text-sm text-gray-900 local-due-with-tax-cell">${formatLocalDuesWithTaxBreakdown(duesBreakdown)}</td>
        <td class="px-4 py-3 text-sm text-gray-900 active-member-cell">${duesBreakdown.fullYear > 0 ? 'Yes' : 'No'}</td>
        <td class="px-4 py-3 text-sm text-gray-900 prorated-months-cell">${duesBreakdown.proratedMonths || 0}</td>
        <td class="px-4 py-3 text-sm text-gray-900">
            <button class="btn btn-sm btn-secondary edit-member-btn" data-member-id="${memberId}">Edit</button>
            <button class="btn btn-sm btn-danger delete-member-btn" data-member-id="${memberId}">Delete</button>
        </td>
    `;
    
    memberRosterBody.appendChild(row);
    
    // Clear form
    memberNameInput.value = '';
    memberTypeInput.value = '';
    joinDateInput.value = '';
    leaveDateInput.value = '';
    
    // Clear validation states
    formValidator.clearAllErrors();
    
    // Update totals
    updateTotal();
    
    // Show success message
    showSuccessMessage('Member added successfully!');
    
    PerformanceMonitor.endTimer('addMember');
}

// ============================================================================
// INITIALIZATION & EVENT HANDLERS
// ============================================================================

// Initialize the application
function initializeApp() {
    PerformanceMonitor.startTimer('appInitialization');
    
    // Initialize DOM cache
    DOMCache.initialize();
    
    // Set up event delegation
    const memberRosterBody = DOMCache.get('member-roster-body');
    if (memberRosterBody) {
        EventManager.delegate(memberRosterBody, '.edit-member-btn', 'click', handleEditMember);
        EventManager.delegate(memberRosterBody, '.delete-member-btn', 'click', handleDeleteMember);
    }
    
    // Set up form event listeners
    const addMemberForm = DOMCache.get('add-member-form');
    if (addMemberForm) {
        addMemberForm.addEventListener('submit', addMember);
    }
    
    // Set up input event listeners for real-time validation
    const formInputs = ['member-name', 'member-type', 'join-date', 'leave-date'];
    formInputs.forEach(inputId => {
        const input = DOMCache.get(inputId);
        if (input) {
            input.addEventListener('blur', () => formValidator.validateField(inputId));
            input.addEventListener('input', () => formValidator.clearFieldError(inputId));
        }
    });
    
    // Set up calculation triggers
    const calculationInputs = ['invoice-year-select', 'tax-percentage', 'currency-rate'];
    calculationInputs.forEach(inputId => {
        const input = DOMCache.get(inputId);
        if (input) {
            input.addEventListener('change', debouncedUpdateTotal);
        }
    });
    
    // Initial calculation
    updateTotal();
    
    PerformanceMonitor.endTimer('appInitialization');
    
    // Set up periodic memory cleanup
    setInterval(() => {
        MemoryManager.cleanup();
    }, 300000); // Every 5 minutes
}

// Handle edit member
function handleEditMember(e, target) {
    const memberId = target.dataset.memberId;
    const row = document.getElementById(memberId);
    
    if (!row || row.classList.contains('editing')) return;
    
    // Enter edit mode
    row.classList.add('editing');
    
    // Replace cells with input fields
    const cells = row.querySelectorAll('td');
    const name = row.dataset.name;
    const memberType = row.dataset.memberType;
    const joinDate = row.dataset.joinDate;
    const leaveDate = row.dataset.leaveDate;
    
    cells[0].innerHTML = `<input type="text" class="edit-mode-input" value="${SecurityUtils.sanitizeHTML(name)}" data-field="name">`;
    cells[1].innerHTML = `
        <select class="edit-mode-select" data-field="memberType">
            <option value="Community-Based" ${memberType === 'Community-Based' ? 'selected' : ''}>Community-Based</option>
            <option value="University-Based" ${memberType === 'University-Based' ? 'selected' : ''}>University-Based</option>
        </select>
    `;
    cells[2].innerHTML = `<input type="date" class="edit-mode-input" value="${joinDate}" data-field="joinDate">`;
    cells[3].innerHTML = `<input type="date" class="edit-mode-input" value="${leaveDate || ''}" data-field="leaveDate">`;
    cells[9].innerHTML = `
        <button class="btn btn-sm btn-primary save-member-btn" data-member-id="${memberId}">Save</button>
        <button class="btn btn-sm btn-secondary cancel-edit-btn" data-member-id="${memberId}">Cancel</button>
    `;
    
    // Set up save and cancel handlers
    const saveBtn = row.querySelector('.save-member-btn');
    const cancelBtn = row.querySelector('.cancel-edit-btn');
    
    saveBtn.addEventListener('click', () => saveMemberEdit(memberId));
    cancelBtn.addEventListener('click', () => cancelMemberEdit(memberId));
}

// Handle delete member
function handleDeleteMember(e, target) {
    const memberId = target.dataset.memberId;
    const row = document.getElementById(memberId);
    
    if (!row) return;
    
    if (confirm('Are you sure you want to delete this member?')) {
        row.remove();
        updateTotal();
        showSuccessMessage('Member deleted successfully!');
    }
}

// Save member edit
function saveMemberEdit(memberId) {
    const row = document.getElementById(memberId);
    if (!row) return;
    
    const nameInput = row.querySelector('[data-field="name"]');
    const memberTypeSelect = row.querySelector('[data-field="memberType"]');
    const joinDateInput = row.querySelector('[data-field="joinDate"]');
    const leaveDateInput = row.querySelector('[data-field="leaveDate"]');
    
    const name = nameInput.value.trim();
    const memberType = memberTypeSelect.value;
    const joinDate = joinDateInput.value;
    const leaveDate = leaveDateInput.value;
    
    // Validate inputs
    if (!SecurityUtils.validateMemberName(name)) {
        showErrorMessage('Invalid member name');
        return;
    }
    
    if (!SecurityUtils.validateDate(joinDate)) {
        showErrorMessage('Invalid join date');
        return;
    }
    
    if (leaveDate && !SecurityUtils.validateDate(leaveDate)) {
        showErrorMessage('Invalid leave date');
        return;
    }
    
    // Update row data
    row.dataset.name = name;
    row.dataset.memberType = memberType;
    row.dataset.joinDate = joinDate;
    row.dataset.leaveDate = leaveDate;
    
    // Exit edit mode and update display
    exitEditMode(row);
    
    // Recalculate dues
    const selectedYear = parseInt(DOMCache.get('invoice-year-select')?.value, 10);
    const duesBreakdown = calculateIndividualDue(joinDate, memberType, selectedYear, leaveDate);
    
    const cells = row.querySelectorAll('td');
    cells[0].textContent = name;
    cells[1].textContent = memberType;
    cells[2].textContent = joinDate;
    cells[3].textContent = leaveDate || '-';
    cells[4].innerHTML = formatDuesBreakdown(duesBreakdown);
    cells[5].innerHTML = formatLocalDuesBreakdown(duesBreakdown);
    cells[6].innerHTML = formatLocalDuesWithTaxBreakdown(duesBreakdown);
    cells[7].textContent = duesBreakdown.fullYear > 0 ? 'Yes' : 'No';
    cells[8].textContent = duesBreakdown.proratedMonths || 0;
    cells[9].innerHTML = `
        <button class="btn btn-sm btn-secondary edit-member-btn" data-member-id="${memberId}">Edit</button>
        <button class="btn btn-sm btn-danger delete-member-btn" data-member-id="${memberId}">Delete</button>
    `;
    
    row.dataset.due = duesBreakdown.total;
    
    // Update totals
    updateTotal();
    
    showSuccessMessage('Member updated successfully!');
}

// Cancel member edit
function cancelMemberEdit(memberId) {
    const row = document.getElementById(memberId);
    if (!row) return;
    
    exitEditMode(row);
}

// Exit edit mode
function exitEditMode(row) {
    row.classList.remove('editing');
    
    // Restore original content
    const name = row.dataset.name;
    const memberType = row.dataset.memberType;
    const joinDate = row.dataset.joinDate;
    const leaveDate = row.dataset.leaveDate;
    const memberId = row.id;
    
    const cells = row.querySelectorAll('td');
    cells[0].textContent = name;
    cells[1].textContent = memberType;
    cells[2].textContent = joinDate;
    cells[3].textContent = leaveDate || '-';
    cells[9].innerHTML = `
        <button class="btn btn-sm btn-secondary edit-member-btn" data-member-id="${memberId}">Edit</button>
        <button class="btn btn-sm btn-danger delete-member-btn" data-member-id="${memberId}">Delete</button>
    `;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function showSuccessMessage(message) {
    // Implementation for success message display
    console.log('Success:', message);
}

function showErrorMessage(message) {
    // Implementation for error message display
    console.error('Error:', message);
}

function updateInvoiceDateDisplay() {
    // Implementation for updating invoice date display
    const selectedYear = DOMCache.get('invoice-year-select')?.value;
    if (selectedYear) {
        // Update invoice date display logic
    }
}

// ============================================================================
// APPLICATION STARTUP
// ============================================================================

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateIndividualDue,
        SecurityUtils,
        PerformanceMonitor,
        DOMCache,
        EventManager
    };
} 