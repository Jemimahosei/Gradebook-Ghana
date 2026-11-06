package com.gradebook.repository;
import com.gradebook.model.SchoolClass;
import com.gradebook.model.Teacher;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface SchoolClassRepository extends JpaRepository<SchoolClass, Long> {
    Optional<SchoolClass> findByClassTeacher(Teacher teacher);
    Optional<SchoolClass> findByName(String name);
}
