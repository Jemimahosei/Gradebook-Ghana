package com.gradebook.repository;

import com.gradebook.model.Grade;
import com.gradebook.model.SchoolClass;
import com.gradebook.model.Student;
import com.gradebook.model.Subject;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface GradeRepository extends JpaRepository<Grade, Long> {
    List<Grade> findByStudentId(Long studentId);
    List<Grade> findByStudentIdAndSemester(Long studentId, String semester);
    List<Grade> findBySemester(String semester);
    Optional<Grade> findByStudentAndSubject(Student student, Subject subject);
    Optional<Grade> findByStudentAndSubjectAndSemester(Student student, Subject subject, String semester);

    @Query("SELECT g FROM Grade g WHERE g.student.schoolClass = :schoolClass AND g.semester = :semester")
    List<Grade> findBySchoolClassAndSemester(@Param("schoolClass") SchoolClass schoolClass, @Param("semester") String semester);

    List<Grade> findByStudentIdAndPublishedTrue(Long studentId);
    List<Grade> findByStudentAndSemester(Student student, String semester);
}
