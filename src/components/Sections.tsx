import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Briefcase, Code, FolderGit2, Mail, Github, Linkedin, Twitter, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SectionsProps {
  skills: string[];
  experience: Array<{
    role: string;
    company: string;
    period: string;
    impact: string;
  }>;
  projects: Array<{
    title: string;
    description: string;
    tech: string[];
    link: string;
  }>;
  contact: {
    email: string;
    github: string;
    linkedin: string;
    twitter: string;
  };
}

export function Sections({ skills, experience, projects, contact }: SectionsProps) {
  return (
  <div className="py-12 px-4 md:py-20 md:px-6 space-y-12 md:space-y-20 bg-gradient-to-b from-background to-primary/5">
      {/* Skills */}
  <section className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Code className="h-8 w-8 text-primary" />
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Skills & Technologies</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          {skills.map((skill) => (
            <Badge
              key={skill}
              variant="outline"
              className="px-4 py-2 text-base border-primary/50 hover:bg-primary/10 hover:border-primary transition-all hover:scale-105 bg-background/50 backdrop-blur-sm"
            >
              {skill}
            </Badge>
          ))}
        </div>
      </section>

      {/* Experience */}
  <section className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Briefcase className="h-8 w-8 text-primary" />
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Experience</h2>
        </div>
        <div className="space-y-6">
          {experience.map((exp, index) => (
            <Card key={index} className="bg-card/70 backdrop-blur-sm border-primary/20 hover:border-primary/50 transition-all hover:scale-[1.02] shadow-lg">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{exp.role}</CardTitle>
                    <CardDescription className="text-base mt-1">{exp.company}</CardDescription>
                  </div>
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">{exp.period}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{exp.impact}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Projects */}
      <section className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <FolderGit2 className="h-8 w-8 text-primary" />
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Featured Projects</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {projects.map((project, index) => (
            <Card key={index} className="bg-card/70 backdrop-blur-sm border-primary/20 hover:border-primary/50 transition-all hover:scale-105 shadow-lg cursor-pointer w-full"
                  onClick={() => window.open(project.link, '_blank')}>
              <CardHeader>
                <CardTitle className="text-lg">{project.title}</CardTitle>
                <CardDescription>{project.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-4">
                  {project.tech.map((tech) => (
                    <Badge key={tech} variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                      {tech}
                    </Badge>
                  ))}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-primary/50 hover:bg-primary/10 hover:border-primary transition-all w-full md:w-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(project.link, '_blank');
                  }}
                >
                  View Project
                  <ExternalLink className="ml-2 h-3 w-3" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Contact */}
  <section className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Mail className="h-8 w-8 text-primary" />
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Get In Touch</h2>
        </div>
        <Card className="bg-card/70 backdrop-blur-sm border-primary/20 shadow-lg">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div>
                <p className="text-lg mb-2">Let's connect!</p>
                <p className="text-muted-foreground">{contact.email}</p>
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  size="icon" 
                    className="border-primary/50 hover:bg-primary/10 hover:border-primary transition-all"
                  onClick={() => window.open(contact.github, '_blank')}
                  title="GitHub Profile"
                >
                  <Github className="h-5 w-5" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="border-primary/50 hover:bg-primary/10 hover:border-primary transition-all"
                  onClick={() => window.open(contact.linkedin, '_blank')}
                  title="LinkedIn Profile"
                >
                  <Linkedin className="h-5 w-5" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="border-primary/50 hover:bg-primary/10 hover:border-primary transition-all"
                  onClick={() => window.open(contact.twitter, '_blank')}
                  title="Twitter Profile"
                >
                  <Twitter className="h-5 w-5" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="border-primary/50 hover:bg-primary/10 hover:border-primary transition-all"
                  onClick={() => window.open(`mailto:${contact.email}`, '_self')}
                  title="Send Email"
                >
                  <Mail className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
