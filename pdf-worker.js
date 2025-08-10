// PDF Generation Web Worker
// This worker handles PDF generation to prevent blocking the main thread

self.importScripts(
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.29/jspdf.plugin.autotable.min.js'
);

// Listen for messages from the main thread
self.addEventListener('message', function(e) {
    const { type, data } = e.data;
    
    switch (type) {
        case 'generatePDF':
            generatePDF(data);
            break;
        default:
            self.postMessage({ type: 'error', error: 'Unknown message type' });
    }
});

function generatePDF(data) {
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
        
        // Create PDF document
        const { jsPDF } = self.jspdf;
        const doc = new jsPDF();
        
        // Set document properties
        doc.setProperties({
            title: `Rotaract Club Invoice Estimate - January ${invoiceYear}`,
            subject: 'Invoice Calculation Report',
            author: 'Rotaract South Asia MDIO',
            creator: 'Rotaract Club Invoice Calculator'
        });

        let yPosition = 25;
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 20;
        const contentWidth = pageWidth - (2 * margin);
        let currentPage = 1;

        // Add main title
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
        
        // Date and Year
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

        // Invoice Summary Section
        doc.setFillColor(59, 130, 246);
        doc.rect(margin - 5, yPosition - 5, contentWidth + 10, 15, 'F');
        
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('Invoice Summary', pageWidth / 2, yPosition + 5, { align: 'center' });
        
        yPosition += 20;
        
        // Summary table with 3 columns
        const summaryTableData = [
            ['(a) Base RI Dues', 
             `$${summaryData.baseAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
             `${summaryData.baseLocalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
            [`  (a1) Active Member Dues (Jan - Dec ${invoiceYear})`, 
             `$${summaryData.totalFullYearAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
             `${summaryData.fullYearLocalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
            ['  (a2) Prorated Dues', 
             `$${summaryData.totalProratedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
             `${summaryData.proratedLocalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
            [`(b) Tax (${taxPercentage}%)`, 
             `$${summaryData.taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
             `${summaryData.taxLocalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
            [`  (b1) Tax on Active Member Dues (Jan - Dec ${invoiceYear})`, 
             `$${(Math.round((summaryData.totalFullYearAmount * taxPercentage) / 100 * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
             `${(Math.round((summaryData.fullYearLocalAmount * taxPercentage) / 100 * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
            ['  (b2) Tax on Prorated Dues', 
             `$${(Math.round((summaryData.totalProratedAmount * taxPercentage) / 100 * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
             `${(Math.round((summaryData.proratedLocalAmount * taxPercentage) / 100 * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
            ['(c) Total with Tax', 
             `$${summaryData.totalWithTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
             `${summaryData.totalLocalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
            ['', '', ''],
            ['Exchange Rate', '$1.00', `${currencyRate.toFixed(2)}`],
            ['', '', ''],
            ['Total Members', totalMembers, ''],
            ['Total Prorated Months', totalProratedMonths, '']
        ];

        doc.autoTable({
            startY: yPosition,
            head: [['Description', 'USD Amount', 'Local Amount']],
            body: summaryTableData,
            theme: 'plain',
            headStyles: {
                textColor: [55, 65, 81],
                fontStyle: 'bold',
                fontSize: 11,
                halign: 'center',
                valign: 'middle',
                cellPadding: 4,
                lineColor: [200, 200, 200],
                lineWidth: 0.1,
                fillColor: [248, 250, 252]
            },
            styles: {
                fontSize: 10,
                cellPadding: 3,
                textColor: [75, 85, 99],
                lineColor: [220, 220, 220],
                lineWidth: 0.1
            },
            columnStyles: {
                0: { fontStyle: 'bold', textColor: [55, 65, 81] },
                1: { halign: 'center', fontStyle: 'bold', textColor: [55, 65, 81] },
                2: { halign: 'center', fontStyle: 'bold', textColor: [55, 65, 81] }
            },
            didParseCell: function(data) {
                // Sub-items styling
                if (data.row.raw[0] && (data.row.raw[0].includes(`(a1) Active Member Dues (Jan - Dec ${invoiceYear})`) || data.row.raw[0].includes('(a2) Prorated Dues') || data.row.raw[0].includes(`(b1) Tax on Active Member Dues (Jan - Dec ${invoiceYear})`) || data.row.raw[0].includes('(b2) Tax on Prorated Dues'))) {
                    data.cell.styles.fontSize = 10;
                    data.cell.styles.textColor = [156, 163, 175];
                    data.cell.styles.fontStyle = 'normal';
                }
                // Exchange rate row styling
                if (data.row.raw[0] && data.row.raw[0] === 'Exchange Rate') {
                    data.cell.styles.fillColor = [239, 246, 255];
                    data.cell.styles.textColor = [59, 130, 246];
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fontSize = 11;
                }
                // Empty rows
                if (data.row.raw[0] === '' && data.row.raw[1] === '' && data.row.raw[2] === '') {
                    data.cell.styles.minCellHeight = 5;
                }
            },
            tableWidth: 'auto',
            margin: { left: margin, right: margin }
        });

        yPosition = doc.lastAutoTable.finalY + 8;
        
        // Add legend
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(156, 163, 175);
        doc.text('Base RI Dues (a = a1 + a2) = Active Member Dues (a1) + Prorated Dues (a2)', pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 5;
        doc.text('Tax (b = b1 + b2) = Tax on Active Member Dues (b1) + Tax on Prorated Dues (b2)', pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 5;
        doc.text('Total with Tax (c = a + b) = Base RI Dues (a) + Tax (b)', pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 5;
        doc.text(`Local currency amounts calculated using exchange rate: 1 USD = ${currencyRate} Local`, pageWidth / 2, yPosition, { align: 'center' });
        
        yPosition += 15;

        // Member Roster Section
        if (memberData && memberData.length > 0) {
            doc.addPage();
            currentPage = 2;
        
            // Page 2 header
            doc.setFillColor(25, 118, 210);
            doc.rect(0, 0, pageWidth, 30, 'F');
            
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(255, 255, 255);
            doc.text('Rotaract Club Invoice Calculator', pageWidth / 2, 12, { align: 'center' });
            
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(255, 255, 255);
            doc.text('Member Roster', pageWidth / 2, 22, { align: 'center' });
            
            yPosition = 40;

            // Member roster table
            try {
                doc.autoTable({
                    startY: yPosition,
                    head: [['Name', 'Join Date', 'Leave Date', 'Club Base', 'Est. Base Due (USD)', 'Est. Base Due (Local)', 'Active Member', 'Prorated Months']],
                    body: memberData,
                    theme: 'plain',
                    headStyles: {
                        textColor: [55, 65, 81],
                        fontStyle: 'bold',
                        fontSize: 7,
                        halign: 'center',
                        valign: 'middle',
                        cellPadding: 2,
                        lineColor: [200, 200, 200],
                        lineWidth: 0.1,
                        fillColor: [248, 250, 252]
                    },
                    columnStyles: {
                        0: { halign: 'left', fontStyle: 'bold', textColor: [55, 65, 81], cellWidth: 30 },
                        1: { halign: 'center', textColor: [75, 85, 99], cellWidth: 18 },
                        2: { halign: 'center', textColor: [75, 85, 99], cellWidth: 18 },
                        3: { halign: 'center', textColor: [75, 85, 99], cellWidth: 25 },
                        4: { halign: 'center', textColor: [75, 85, 99], cellWidth: 35 },
                        5: { halign: 'center', textColor: [75, 85, 99], cellWidth: 35 },
                        6: { halign: 'center', textColor: [75, 85, 99], cellWidth: 20 },
                        7: { halign: 'center', textColor: [75, 85, 99], cellWidth: 20 }
                    },
                    tableWidth: pageWidth - 10,
                    margin: { top: 40, bottom: 20, left: 5, right: 5 },
                    pageBreak: 'auto',
                    showFoot: 'lastPage',
                    startY: yPosition,
                    styles: {
                        fontSize: 7,
                        cellPadding: 2,
                        textColor: [75, 85, 99],
                        lineColor: [220, 220, 220],
                        lineWidth: 0.1,
                        overflow: 'linebreak',
                        halign: 'left'
                    },
                    didStartPage: function(data) {
                        if (data.pageNumber >= 3) {
                            yPosition = 40;
                        }
                    },
                    didDrawPage: function(data) {
                        if (data.pageNumber === 2) {
                            try {
                                const tableX = data.table.x;
                                const tableY = data.table.y;
                                const columnWidth = data.table.width / 8;
                                const estBaseDueUSDX = tableX + (columnWidth * 4);
                                const estBaseDueLocalX = tableX + (columnWidth * 5);
                                
                                doc.setFontSize(6);
                                doc.setFont('helvetica', 'normal');
                                doc.setTextColor(156, 163, 175);
                                doc.text('(Annual + Prorated)', estBaseDueUSDX + (columnWidth / 2), tableY - 2, { align: 'center' });
                                doc.text('(Annual + Prorated)', estBaseDueLocalX + (columnWidth / 2), tableY - 2, { align: 'center' });
                            } catch (textError) {
                                // Could not add subtitle text
                            }
                        }
                        
                        if (data.pageNumber >= 2) {
                            try {
                                doc.setFillColor(25, 118, 210);
                                doc.rect(0, 0, pageWidth, 30, 'F');
                                
                                doc.setFontSize(16);
                                doc.setFont('helvetica', 'bold');
                                doc.setTextColor(255, 255, 255);
                                doc.text('Rotaract Club Invoice Calculator', pageWidth / 2, 12, { align: 'center' });
                                
                                doc.setFontSize(18);
                                doc.setFont('helvetica', 'bold');
                                doc.setTextColor(255, 255, 255);
                                doc.text('Member Roster (Continued)', pageWidth / 2, 22, { align: 'center' });
                            } catch (headerError) {
                                // Could not add overflow page header
                            }
                        }
                        
                        currentPage = data.pageNumber + 1;
                    },
                    didParseCell: function(data) {
                        if (data.row.raw[0] === 'TOTAL') {
                            data.cell.styles.fontStyle = 'bold';
                            data.cell.styles.fillColor = [240, 240, 240];
                            data.cell.styles.textColor = [55, 65, 81];
                        }
                    }
                });
            } catch (tableError) {
                console.error('Error generating member roster table:', tableError);
                
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(220, 38, 127);
                doc.text('Error: Could not generate member roster table', pageWidth / 2, yPosition + 20, { align: 'center' });
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(75, 85, 99);
                doc.text(`Total members found: ${memberData.length - 1}`, pageWidth / 2, yPosition + 35, { align: 'center' });
                yPosition += 50;
            }
        }

        // Disclaimer Section
        yPosition = doc.lastAutoTable ? doc.lastAutoTable.finalY + 25 : yPosition + 25;
        
        if (yPosition > pageHeight - 100) {
            doc.addPage();
            currentPage++;
            
            doc.setFillColor(25, 118, 210);
            doc.rect(0, 0, pageWidth, 30, 'F');
            
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(255, 255, 255);
            doc.text('Rotaract Club Invoice Calculator', pageWidth / 2, 12, { align: 'center' });
            
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(255, 255, 255);
            doc.text('Disclaimer', pageWidth / 2, 22, { align: 'center' });
            
            yPosition = 45;
        }
        
        // Disclaimer Section
        doc.setFillColor(239, 68, 68);
        doc.rect(margin - 5, yPosition - 5, contentWidth + 10, 15, 'F');
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('Disclaimer', pageWidth / 2, yPosition + 5, { align: 'center' });
        
        yPosition += 20;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(75, 85, 99);
        
        const disclaimerText = [
            'This report contains indicative estimates for Rotaract Club Invoice calculations. All calculations are based on the information provided and current Rotary International dues structure. Actual figures may vary based on various factors including but not limited to:',
            '',
            '• Changes in Rotary International dues structure',
            '• Currency exchange rates and fluctuations',
            '• Timing of member additions and removals',
            '• Outstanding dues from previous years',
            '',
            'Please verify all calculations with official Rotary International sources. This tool is designed to assist with preliminary estimates and should not be considered as official documentation.',
            '',
            'Generated by: Rotaract Club Invoice Calculator - A tool by Rotaract South Asia MDIO',
            'Powered by: ZeoSpec (https://rtr.zeospec.com/)'
        ];

        disclaimerText.forEach(line => {
            if (yPosition > pageHeight - 30) {
                doc.addPage();
                currentPage++;
                yPosition = 20;
            }
            
            if (line.trim() === '') {
                yPosition += 8;
            } else if (line.startsWith('•')) {
                doc.text(line, margin + 5, yPosition);
                yPosition += 8;
            } else {
                const splitText = doc.splitTextToSize(line, contentWidth);
                splitText.forEach(textLine => {
                    doc.text(textLine, margin, yPosition, { align: 'justify' });
                    yPosition += 6;
                });
                yPosition += 2;
            }
        });

        // Enhanced footer
        const totalPages = currentPage;
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            
            doc.setFillColor(248, 250, 252);
            doc.rect(0, pageHeight - 10, pageWidth, 10, 'F');
            
            doc.setFontSize(8);
            doc.setTextColor(156, 163, 175);
            doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
            
            doc.setDrawColor(229, 231, 235);
            doc.setLineWidth(0.5);
            doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
        }

        // Convert to blob and send back
        const pdfBlob = doc.output('blob');
        self.postMessage({ 
            type: 'pdfGenerated', 
            blob: pdfBlob,
            fileName: `Rotaract Club Invoice Estimate - January ${invoiceYear}.pdf`
        });
        
    } catch (error) {
        self.postMessage({ 
            type: 'error', 
            error: error.message || 'PDF generation failed' 
        });
    }
} 