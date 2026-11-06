package com.gradebook.repository;

import com.gradebook.model.SchoolClass;
import com.gradebook.model.SubjectAssignment;
import com.gradebook.model.Teacher;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SubjectAssignmentRepository extends JpaRepository<SubjectAssignment, Long> {
    List<SubjectAssignment> findByTeacher(Teacher teacher);
    List<SubjectAssignment> findBySchoolClass(SchoolClass schoolClass);
}
