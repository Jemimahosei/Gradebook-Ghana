package com.gradebook.service;

import com.gradebook.model.Student;
import com.lowagie.text.Document;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.Paragraph;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.util.List;

/**
 * Report-card exports (CSV + PDF via OpenPDF) from per-subject result rows.
 * Simple clean layout — school header, student bio, one row per subject
 * (Class 30% / Exam 70% / Total / Grade / Remark), overall average and
 * class rank. The "Demo data" footer line appears only for the demo school.
 */
@Service
public class ReportCardService {

    public record ResultRow(String subject, Double classScore, Double examScore,
                            Double total, String letter, String remark) {
    }

    public String toCsv(List<ResultRow> rows) {
        StringBuilder sb = new StringBuilder();
        sb.append("Subject,Class Score (30%),Exam Score (70%),Total,Grade,Remark\n");
        for (ResultRow r : rows) {
            sb.append(csv(r.subject())).append(",")
                    .append(num(r.classScore())).append(",")
                    .append(num(r.examScore())).append(",")
                    .append(num(r.total())).append(",")
                    .append(csv(r.letter())).append(",")
                    .append(csv(r.remark())).append("\n");
        }
        return sb.toString();
    }

    private String num(Double v) {
        return v == null ? "" : String.valueOf(v);
    }

    private String csv(String value) {
        if (value == null) {
            return "";
        }
        String v = value.replace("\"", "\"\"");
        return (v.contains(",") || v.contains("\"") || v.contains("\n")) ? "\"" + v + "\"" : v;
    }

    public byte[] toPdf(Student student, String schoolName, String className, String termSummary,
                        List<ResultRow> rows, Double overallAverage, Integer classRank,
                        int classSize, boolean demoSchool) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document doc = new Document();
        PdfWriter.getInstance(doc, out);
        doc.open();

        Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 16, new Color(0x76, 0xB9, 0x00));
        Font headingFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12);
        Font normal = FontFactory.getFont(FontFactory.HELVETICA, 11);

        doc.add(new Paragraph(schoolName, titleFont));
        doc.add(new Paragraph("Student Report Card", headingFont));
        doc.add(new Paragraph("Term: " + (termSummary == null ? "" : termSummary), normal));
        doc.add(new Paragraph(" "));
        doc.add(new Paragraph("Student: " + student.getFullName()
                + " (" + student.getIndexNumber() + ")", normal));
        doc.add(new Paragraph("Class: " + (className == null ? "" : className)
                + "  |  Programme: " + (student.getProgramme() == null ? "" : student.getProgramme()), normal));
        doc.add(new Paragraph("Overall average: "
                + (overallAverage == null ? "N/A" : String.format("%.2f%%", overallAverage)), normal));
        doc.add(new Paragraph("Class rank: " + (classRank == null ? "N/A"
                : classRank + " of " + classSize), normal));
        doc.add(new Paragraph(" "));

        PdfPTable table = new PdfPTable(6);
        table.setWidthPercentage(100);
        table.addCell("Subject");
        table.addCell("Class (30%)");
        table.addCell("Exam (70%)");
        table.addCell("Total");
        table.addCell("Grade");
        table.addCell("Remark");
        for (ResultRow r : rows) {
            table.addCell(r.subject() == null ? "" : r.subject());
            table.addCell(num(r.classScore()));
            table.addCell(num(r.examScore()));
            table.addCell(r.total() == null ? "-" : String.format("%.2f", r.total()));
            table.addCell(r.letter() == null ? "" : r.letter());
            table.addCell(r.remark() == null ? "" : r.remark());
        }
        doc.add(table);
        doc.add(new Paragraph(" "));
        if (demoSchool) {
            doc.add(new Paragraph("Demo data — not a real school.", normal));
        } else {
            doc.add(new Paragraph("Gradebook Ghana — free grading for Ghanaian senior high schools.", normal));
        }
        doc.close();
        return out.toByteArray();
    }
}
