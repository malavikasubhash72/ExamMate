import { Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { extractSyllabusFromPDF, inferSubjectFromFilename } from '../services/pdfExtractor';

export const uploadSyllabusFile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const filesToProcess: Express.Multer.File[] = [];

    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      filesToProcess.push(...(req.files as Express.Multer.File[]));
    } else if (req.file) {
      filesToProcess.push(req.file);
    }

    if (filesToProcess.length === 0) {
      return res.status(400).json({ message: 'Please select at least one valid PDF syllabus file.' });
    }

    const createdSyllabi: any[] = [];
    const errors: string[] = [];

    for (const file of filesToProcess) {
      const fileName = file.originalname;
      const filePath = file.path;
      const inferredSubjectName = inferSubjectFromFilename(fileName);

      try {
        const extractedData = await extractSyllabusFromPDF(filePath, fileName, inferredSubjectName);

        const syllabus = await prisma.syllabus.create({
          data: {
            user_id: userId,
            file_name: fileName,
            file_path: filePath,
            subject_name: inferredSubjectName,
            status: 'PROCESSED',
            subjects: {
              create: extractedData.subjects.map((sub) => ({
                name: sub.name,
                modules: {
                  create: sub.modules.map((mod) => ({
                    name: mod.name,
                    topics: {
                      create: mod.topics.map((top) => ({
                        name: top.name,
                        status: 'PENDING',
                      })),
                    },
                  })),
                },
              })),
            },
          },
          include: {
            subjects: {
              include: {
                modules: {
                  include: {
                    topics: true,
                  },
                },
              },
            },
          },
        });

        createdSyllabi.push(syllabus);
      } catch (err: any) {
        // Create failed syllabus record so student can retry or enter manually
        const failedSyllabus = await prisma.syllabus.create({
          data: {
            user_id: userId,
            file_name: fileName,
            file_path: filePath,
            subject_name: inferredSubjectName,
            status: 'FAILED',
          },
          include: { subjects: true },
        });

        createdSyllabi.push(failedSyllabus);
        errors.push(`${fileName} could not be extracted automatically.`);
      }
    }

    // Create notification
    await prisma.notification.create({
      data: {
        user_id: userId,
        title: 'Syllabus PDF(s) Processed',
        message: `Processed ${filesToProcess.length} syllabus PDF file(s). ${createdSyllabi.filter((s) => s.status === 'PROCESSED').length} successfully extracted.`,
        type: 'INFO',
      },
    });

    res.status(201).json({
      message: 'Syllabus files uploaded and processed.',
      syllabi: createdSyllabi,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Server error uploading syllabus files.' });
  }
};

export const getSyllabi = async (req: AuthRequest, res: Response) => {
  try {
    const syllabi = await prisma.syllabus.findMany({
      where: { user_id: req.userId },
      include: {
        subjects: {
          include: {
            modules: {
              include: {
                topics: true,
              },
            },
          },
        },
      },
      orderBy: { upload_date: 'desc' },
    });

    res.json({ syllabi });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Server error fetching syllabi.' });
  }
};

export const getSyllabusById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const syllabus = await prisma.syllabus.findFirst({
      where: { id, user_id: req.userId },
      include: {
        subjects: {
          include: {
            modules: {
              include: {
                topics: true,
              },
            },
          },
        },
      },
    });

    if (!syllabus) {
      return res.status(404).json({ message: 'Syllabus file not found.' });
    }

    res.json({ syllabus });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Server error fetching syllabus.' });
  }
};

export const processSyllabus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { subject_name } = req.body;
    const userId = req.userId!;

    const syllabus = await prisma.syllabus.findFirst({
      where: { id, user_id: userId },
    });

    if (!syllabus) {
      return res.status(404).json({ message: 'Syllabus not found.' });
    }

    const assignedSubject = subject_name || syllabus.subject_name || inferSubjectFromFilename(syllabus.file_name);

    try {
      const extractedData = await extractSyllabusFromPDF(syllabus.file_path, syllabus.file_name, assignedSubject);

      // Remove previous subjects for this syllabus if retrying
      await prisma.subject.deleteMany({
        where: { syllabus_id: id },
      });

      const updatedSyllabus = await prisma.syllabus.update({
        where: { id },
        data: {
          subject_name: assignedSubject,
          status: 'PROCESSED',
          subjects: {
            create: extractedData.subjects.map((sub) => ({
              name: sub.name,
              modules: {
                create: sub.modules.map((mod) => ({
                  name: mod.name,
                  topics: {
                    create: mod.topics.map((top) => ({
                      name: top.name,
                      status: 'PENDING',
                    })),
                  },
                })),
              },
            })),
          },
        },
        include: {
          subjects: {
            include: {
              modules: {
                include: {
                  topics: true,
                },
              },
            },
          },
        },
      });

      res.json({
        message: `Syllabus processed for subject ${assignedSubject}.`,
        syllabus: updatedSyllabus,
      });
    } catch (err: any) {
      await prisma.syllabus.update({
        where: { id },
        data: { status: 'FAILED' },
      });
      res.status(400).json({ message: `Extraction failed for ${syllabus.file_name}. You can add topics manually.` });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error processing syllabus file.' });
  }
};

export const deleteSyllabus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const existing = await prisma.syllabus.findFirst({
      where: { id, user_id: userId },
    });

    if (!existing) {
      return res.status(404).json({ message: 'Syllabus file not found.' });
    }

    await prisma.syllabus.delete({
      where: { id },
    });

    res.json({ message: 'Syllabus file and extracted topics deleted successfully.' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error deleting syllabus file.' });
  }
};

export const updateSyllabusStructure = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { subject_name, subjects } = req.body;
    const userId = req.userId!;

    const existing = await prisma.syllabus.findFirst({
      where: { id, user_id: userId },
    });

    if (!existing) {
      return res.status(404).json({ message: 'Syllabus not found or unauthorized.' });
    }

    if (subjects && Array.isArray(subjects)) {
      await prisma.subject.deleteMany({
        where: { syllabus_id: id },
      });

      await prisma.syllabus.update({
        where: { id },
        data: {
          subject_name: subject_name || existing.subject_name,
          status: 'PROCESSED',
          subjects: {
            create: subjects.map((sub: any) => ({
              name: sub.name,
              modules: {
                create: (sub.modules || []).map((mod: any) => ({
                  name: mod.name,
                  topics: {
                    create: (mod.topics || []).map((top: any) => ({
                      name: typeof top === 'string' ? top : top.name,
                      status: top.status || 'PENDING',
                    })),
                  },
                })),
              },
            })),
          },
        },
      });
    } else if (subject_name) {
      await prisma.syllabus.update({
        where: { id },
        data: { subject_name },
      });
    }

    const updatedSyllabus = await prisma.syllabus.findUnique({
      where: { id },
      include: {
        subjects: {
          include: {
            modules: {
              include: {
                topics: true,
              },
            },
          },
        },
      },
    });

    res.json({
      message: 'Syllabus updated successfully.',
      syllabus: updatedSyllabus,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error updating syllabus.' });
  }
};

export const getAllSubjects = async (req: AuthRequest, res: Response) => {
  try {
    const subjects = await prisma.subject.findMany({
      where: {
        syllabus: { user_id: req.userId },
      },
      include: {
        modules: {
          include: {
            topics: true,
          },
        },
      },
    });

    res.json({ subjects });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching subjects.' });
  }
};

export const getAllTopics = async (req: AuthRequest, res: Response) => {
  try {
    const topics = await prisma.topic.findMany({
      where: {
        module: {
          subject: {
            syllabus: { user_id: req.userId },
          },
        },
      },
      include: {
        module: {
          include: {
            subject: true,
          },
        },
      },
    });

    res.json({ topics });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching topics.' });
  }
};

export const updateSubject = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const userId = req.userId!;

    const subject = await prisma.subject.findFirst({
      where: { id, syllabus: { user_id: userId } },
    });

    if (!subject) {
      return res.status(404).json({ message: 'Subject not found.' });
    }

    const updated = await prisma.subject.update({
      where: { id },
      data: { name },
    });

    res.json({ message: 'Subject updated.', subject: updated });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error updating subject.' });
  }
};

export const updateTopic = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, status } = req.body;
    const userId = req.userId!;

    const topic = await prisma.topic.findFirst({
      where: { id, module: { subject: { syllabus: { user_id: userId } } } },
    });

    if (!topic) {
      return res.status(404).json({ message: 'Topic not found.' });
    }

    const updated = await prisma.topic.update({
      where: { id },
      data: {
        name: name !== undefined ? name : undefined,
        status: status !== undefined ? status : undefined,
      },
    });

    res.json({ message: 'Topic updated.', topic: updated });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error updating topic.' });
  }
};

export const createTopic = async (req: AuthRequest, res: Response) => {
  try {
    const { module_id, name } = req.body;
    const userId = req.userId!;

    const moduleRecord = await prisma.module.findFirst({
      where: { id: module_id, subject: { syllabus: { user_id: userId } } },
    });

    if (!moduleRecord) {
      return res.status(404).json({ message: 'Module not found.' });
    }

    const topic = await prisma.topic.create({
      data: {
        module_id,
        name,
        status: 'PENDING',
      },
    });

    res.status(201).json({ message: 'Topic created.', topic });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error creating topic.' });
  }
};

export const deleteTopic = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const topic = await prisma.topic.findFirst({
      where: { id, module: { subject: { syllabus: { user_id: userId } } } },
    });

    if (!topic) {
      return res.status(404).json({ message: 'Topic not found.' });
    }

    await prisma.topic.delete({ where: { id } });

    res.json({ message: 'Topic deleted.' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error deleting topic.' });
  }
};
