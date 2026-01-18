// Calculation and Formatting Module (non-UI, behavior-preserving)
// Exposes: window.DuesCalculator, window.DuesFormatter, window.Utils

(function() {
	if (!window.Utils) {
		window.Utils = {
			debounce: function(func, wait) {
				let timeout;
				return function executedFunction() {
					const args = arguments;
					const later = () => {
						clearTimeout(timeout);
						func.apply(null, args);
					};
					clearTimeout(timeout);
					timeout = setTimeout(later, wait);
				};
			},
			preciseDecimal: function(value, decimals) {
				const d = typeof decimals === 'number' ? decimals : 2;
				return Math.round(value * Math.pow(10, d)) / Math.pow(10, d);
			}
		};
	}

	if (!window.DuesCalculator) {
		window.DuesCalculator = {
			calculateIndividualDue: function(joinDateStr, clubBase, invoiceYear, leaveDateStr) {
				const joinDate = new Date(joinDateStr + 'T00:00:00');
				const invoiceDate = new Date(invoiceYear, 0, 1);
				const baseDues = clubBase === 'Community-Based' ? 8 : 5;
				const joinYear = joinDate.getFullYear();

				const proratedDuePerMonth = Math.round((baseDues / 12) * 100) / 100;

				if (joinYear === invoiceYear - 1) {
					const joinMonth = joinDate.getMonth();
					const joinDay = joinDate.getDate();
					let effectiveJoinMonth = joinMonth;
					if (joinDay > 1) effectiveJoinMonth += 1;
					const monthsInJoinYear = Math.max(0, 12 - effectiveJoinMonth);
					let proratedDues = Math.round(proratedDuePerMonth * monthsInJoinYear * 100) / 100;

					if (leaveDateStr && leaveDateStr.trim() !== '') {
						const leaveDate = new Date(leaveDateStr + 'T00:00:00');
						if (leaveDate < invoiceDate) {
							const leaveMonth = leaveDate.getMonth();
							let effectiveLeaveMonth = leaveMonth;
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

				if (joinYear === invoiceYear) {
					return { fullYear: 0, prorated: 0, total: 0, proratedMonths: 0 };
				}

				if (joinYear < invoiceYear - 1) {
					if (leaveDateStr && leaveDateStr.trim() !== '') {
						const leaveDate = new Date(leaveDateStr + 'T00:00:00');
						if (leaveDate < invoiceDate) {
							return { fullYear: 0, prorated: 0, total: 0, proratedMonths: 0 };
						}
					}
					return { fullYear: baseDues, prorated: 0, total: baseDues, proratedMonths: 0 };
				}

				return { fullYear: 0, prorated: 0, total: 0, proratedMonths: 0 };
			}
		};
	}

	if (!window.DuesFormatter) {
		window.DuesFormatter = {
			formatUSD: function(duesBreakdown) {
				const { fullYear, prorated, total } = duesBreakdown;
				if (total === 0) return '<span class="text-gray-400">$0.00</span>';
				const p = window.Utils.preciseDecimal;
				if (fullYear > 0 && prorated > 0) return `$${p(fullYear).toFixed(2)} + $${p(prorated).toFixed(2)} = $${p(total).toFixed(2)}`;
				if (fullYear > 0) return `$${p(fullYear).toFixed(2)} + $0.00 = $${p(total).toFixed(2)}`;
				if (prorated > 0) return `$0.00 + $${p(prorated).toFixed(2)} = $${p(total).toFixed(2)}`;
				return `$${p(total).toFixed(2)}`;
			},
			formatLocal: function(duesBreakdown, currencyRate) {
				const { fullYear, prorated, total } = duesBreakdown;
				if (total === 0) return '<span class="text-gray-400">0.00</span>';
				const fullYearLocal = Math.round(fullYear * currencyRate * 100) / 100;
				const proratedLocal = Math.round(prorated * currencyRate * 100) / 100;
				const totalLocal = fullYearLocal + proratedLocal;
				if (fullYear > 0 && prorated > 0) return `${fullYearLocal.toFixed(2)} + ${proratedLocal.toFixed(2)} = ${totalLocal.toFixed(2)}`;
				if (fullYear > 0) return `${fullYearLocal.toFixed(2)} + 0.00 = ${totalLocal.toFixed(2)}`;
				if (prorated > 0) return `0.00 + ${proratedLocal.toFixed(2)} = ${totalLocal.toFixed(2)}`;
				return `${totalLocal.toFixed(2)}`;
			},
			formatLocalWithTax: function(duesBreakdown, currencyRate, taxPercentage) {
				const { total, fullYear, prorated } = duesBreakdown;
				if (total === 0) return '<span class="text-gray-400">0.00</span>';
				const fullYearLocal = Math.round(fullYear * currencyRate * 100) / 100;
				const proratedLocal = Math.round(prorated * currencyRate * 100) / 100;
				const baseLocal = fullYearLocal + proratedLocal;
				const taxOnFullYearLocal = Math.round((fullYearLocal * taxPercentage) / 100 * 100) / 100;
				const taxOnProratedLocal = Math.round((proratedLocal * taxPercentage) / 100 * 100) / 100;
				const taxLocal = taxOnFullYearLocal + taxOnProratedLocal;
				const totalWithTaxLocal = baseLocal + taxLocal;
				if (baseLocal > 0 && taxLocal > 0) return `${baseLocal.toFixed(2)} + ${taxLocal.toFixed(2)} = ${totalWithTaxLocal.toFixed(2)}`;
				if (baseLocal > 0) return `${baseLocal.toFixed(2)} + 0.00 = ${totalWithTaxLocal.toFixed(2)}`;
				return `0.00 + 0.00 = ${totalWithTaxLocal.toFixed(2)}`;
			}
		};
	}
})();

