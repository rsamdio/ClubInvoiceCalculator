// ============================================================================
// PDF GENERATION WEB WORKER - PERFORMANCE OPTIMIZED VERSION
// ============================================================================

// Import required libraries with error handling
self.importScripts(
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.29/jspdf.plugin.autotable.min.js'
);

// Performance monitoring for the worker
const WorkerPerformanceMonitor = {
    startTime: null,
    
    start() {
        this.startTime = performance.now();
    },
    
    end(operation) {
        if (this.startTime) {
            const duration = performance.now() - this.startTime;
            self.postMessage({
                type: 'performance',
                operation,
                duration: Math.round(duration)
            });
            this.startTime = null;
        }
    }
};

// Memory management for large datasets
const MemoryManager = {
    chunkSize: 50, // Process data in chunks to prevent memory issues
    
    processInChunks(data, processor) {
        return new Promise((resolve) => {
            const results = [];
            let index = 0;
            
            const processChunk = () => {
                const chunk = data.slice(index, index + this.chunkSize);
                const chunkResults = processor(chunk, index);
                results.push(...chunkResults);
                
                index += this.chunkSize;
                
                if (index < data.length) {
                    // Use setTimeout to prevent blocking
                    setTimeout(processChunk, 0);
                } else {
                    resolve(results);
                }
            };
            
            processChunk();
        });
    }
};

// Listen for messages from the main thread
self.addEventListener('message', function(e) {
    const { type, data } = e.data;
    
    switch (type) {
        case 'generatePDF':
            generatePDF(data);
            break;
        case 'testConnection':
            self.postMessage({ type: 'connectionTest', success: true });
            break;
        default:
            self.postMessage({ type: 'error', error: 'Unknown message type' });
    }
});

// Optimized PDF generation function
async function generatePDF(data) {
    WorkerPerformanceMonitor.start();
    
    try {
        const { 
            memberData, 
            summaryData, 
            invoiceYear, 
            taxPercentage,
            currencyRate,
            totalMembers,
            totalProratedMonths 
        } = data;
        
        // Validate required data
        if (!memberData || !summaryData || !invoiceYear) {
            throw new Error('Missing required data for PDF generation');
        }
        
        // Create PDF document with optimized settings
        const { jsPDF } = self.jspdf;
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
            compress: true // Enable compression for smaller file size
        });
        
        // Set document properties
        doc.setProperties({
            title: `Rotaract Club Invoice Estimate - January ${invoiceYear}`,
            subject: 'Invoice Calculation Report',
            author: 'Rotaract South Asia MDIO',
            creator: 'Rotaract Club Invoice Calculator',
            creationDate: new Date()
        });

        let yPosition = 25;
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 20;
        const contentWidth = pageWidth - (2 * margin);
        let currentPage = 1;

        // Add main title with optimized font loading
        doc.setFontSize(25);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(25, 118, 210);
        doc.text('ROTARACT CLUB INVOICE CALCULATOR', pageWidth / 2, yPosition, { align: 'center' });
        
        yPosition += 10;
        
        // Add subtitle
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(75, 85, 99);
        doc.text('(A tool by Rotaract South Asia MDIO)', pageWidth / 2, yPosition, { align: 'center' });
        
        yPosition += 15;
        
        // Add gradient-like header background
        doc.setFillColor(25, 118, 210);
        doc.rect(0, yPosition - 5, pageWidth, 25, 'F');
        
        // Header with white text
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('Estimation Report', pageWidth / 2, yPosition + 10, { align: 'center' });
        
        yPosition += 30;
        
        // Date and Year information
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(75, 85, 99);
        const currentDate = new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        doc.text(`Estimate for Invoice of January, ${invoiceYear}`, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 6;
        doc.text(`(January - December, ${invoiceYear})`, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 6;
        doc.text(`Generated on: ${currentDate}`, pageWidth / 2, yPosition, { align: 'center' });
        
        yPosition += 12;

        // Invoice Summary Section with optimized layout
        doc.setFillColor(59, 130, 246);
        doc.rect(margin - 5, yPosition - 5, contentWidth + 10, 15, 'F');
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('Invoice Summary', margin, yPosition + 5);
        
        yPosition += 20;
        
        // Summary table with optimized data processing
        const summaryTableData = await processSummaryData(summaryData, taxPercentage, currencyRate);
        
        doc.autoTable({
            startY: yPosition,
            head: [['Description', 'Amount (USD)', 'Amount (Local)']],
            body: summaryTableData,
            theme: 'grid',
            headStyles: {
                fillColor: [59, 130, 246],
                textColor: 255,
                fontStyle: 'bold'
            },
            styles: {
                fontSize: 10,
                cellPadding: 5
            },
            columnStyles: {
                0: { cellWidth: 60 },
                1: { cellWidth: 40, halign: 'right' },
                2: { cellWidth: 40, halign: 'right' }
            }
        });
        
        yPosition = doc.lastAutoTable.finalY + 15;
        
        // Member Details Section
        if (memberData && memberData.length > 0) {
            doc.setFillColor(59, 130, 246);
            doc.rect(margin - 5, yPosition - 5, contentWidth + 10, 15, 'F');
            
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(255, 255, 255);
            doc.text('Member Details', margin, yPosition + 5);
            
            yPosition += 20;
            
            // Process member data in chunks to prevent memory issues
            const processedMemberData = await processMemberDataInChunks(memberData, invoiceYear, taxPercentage, currencyRate);
            
            // Generate member table with pagination
            await generateMemberTable(doc, processedMemberData, yPosition, margin, contentWidth);
        }
        
        // Add footer with page numbers
        addPageNumbers(doc, currentPage);
        
        // Generate PDF blob with compression
        const pdfBlob = doc.output('blob');
        
        // Send success response with performance metrics
        WorkerPerformanceMonitor.end('pdfGeneration');
        
        self.postMessage({
            type: 'pdfGenerated',
            blob: pdfBlob,
            fileName: `Rotaract_Invoice_Estimate_${invoiceYear}.pdf`
        });
        
    } catch (error) {
        WorkerPerformanceMonitor.end('error');
        
        self.postMessage({
            type: 'error',
            error: error.message || 'PDF generation failed'
        });
    }
}

// Process summary data with optimization
async function processSummaryData(summaryData, taxPercentage, currencyRate) {
    return MemoryManager.processInChunks([summaryData], (chunk) => {
        const data = chunk[0];
        return [
            ['Base Invoice Amount', `$${data.baseAmount.toFixed(2)}`, `${(data.baseAmount * currencyRate).toFixed(2)}`],
            ['Tax Amount', `$${data.taxAmount.toFixed(2)}`, `${(data.taxAmount * currencyRate).toFixed(2)}`],
            ['Total Invoice Amount', `$${data.totalAmount.toFixed(2)}`, `${(data.totalAmount * currencyRate).toFixed(2)}`],
            ['', '', ''],
            ['Total Members', data.totalMembers.toString(), ''],
            ['Total Prorated Months', data.totalProratedMonths.toString(), '']
        ];
    });
}

// Process member data in chunks for better performance
async function processMemberDataInChunks(memberData, invoiceYear, taxPercentage, currencyRate) {
    return MemoryManager.processInChunks(memberData, (chunk, startIndex) => {
        return chunk.map((member, index) => {
            const globalIndex = startIndex + index;
            return [
                (globalIndex + 1).toString(),
                member.name,
                member.clubBase,
                member.joinDate,
                member.leaveDate || '-',
                `$${member.dueAmount.toFixed(2)}`,
                `${(member.dueAmount * currencyRate).toFixed(2)}`,
                `${(member.dueAmount * (1 + taxPercentage / 100) * currencyRate).toFixed(2)}`,
                member.activeMember ? 'Yes' : 'No',
                member.proratedMonths.toString()
            ];
        });
    });
}

// Generate member table with pagination
async function generateMemberTable(doc, memberData, startY, margin, contentWidth) {
    const itemsPerPage = 25; // Optimize for page size
    const totalPages = Math.ceil(memberData.length / itemsPerPage);
    
    for (let page = 0; page < totalPages; page++) {
        if (page > 0) {
            doc.addPage();
        }
        
        const startIndex = page * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, memberData.length);
        const pageData = memberData.slice(startIndex, endIndex);
        
        const tableY = page === 0 ? startY : 25;
        
        doc.autoTable({
            startY: tableY,
            head: [['#', 'Name', 'Type', 'Join Date', 'Leave Date', 'Due (USD)', 'Due (Local)', 'Due + Tax', 'Active', 'Prorated Months']],
            body: pageData,
            theme: 'grid',
            headStyles: {
                fillColor: [59, 130, 246],
                textColor: 255,
                fontStyle: 'bold',
                fontSize: 9
            },
            styles: {
                fontSize: 8,
                cellPadding: 3,
                overflow: 'linebreak'
            },
            columnStyles: {
                0: { cellWidth: 8, halign: 'center' },
                1: { cellWidth: 25 },
                2: { cellWidth: 20 },
                3: { cellWidth: 20 },
                4: { cellWidth: 20 },
                5: { cellWidth: 18, halign: 'right' },
                6: { cellWidth: 18, halign: 'right' },
                7: { cellWidth: 18, halign: 'right' },
                8: { cellWidth: 12, halign: 'center' },
                9: { cellWidth: 15, halign: 'center' }
            },
            didDrawPage: function(data) {
                // Add page number
                const pageNumber = page + 1;
                doc.setFontSize(10);
                doc.setTextColor(100);
                doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
            }
        });
        
        // Add page numbers
        addPageNumbers(doc, page + 1);
    }
}

// Add page numbers to document
function addPageNumbers(doc) {
    const pageCount = doc.internal.getNumberOfPages();
    
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }
}

// Error handling for library loading
self.addEventListener('error', function(e) {
    self.postMessage({
        type: 'error',
        error: 'Worker error: ' + e.message
    });
});

// Handle unhandled promise rejections
self.addEventListener('unhandledrejection', function(e) {
    self.postMessage({
        type: 'error',
        error: 'Unhandled promise rejection: ' + e.reason
    });
});

// Memory cleanup on worker termination
self.addEventListener('beforeunload', function() {
    // Clean up any resources
    if (typeof MemoryManager !== 'undefined') {
        MemoryManager.chunkSize = null;
    }
});

// Export for testing purposes
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        generatePDF,
        processSummaryData,
        processMemberDataInChunks,
        MemoryManager,
        WorkerPerformanceMonitor
    };
} 