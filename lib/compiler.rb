require 'haml'
require 'haml/exec'

# Don't buffer any output
$stdout.sync = true
$stderr.sync = true

# Signals the parent process that loading 'haml' worked
STDOUT.print '**'

ERROR_PREFIX = "error:\n"
# Reads a random separator
SEPARATOR = STDIN.gets

def compile(filePath)
  template = File.read filePath
  haml_engine = Haml::Engine.new template
  output = haml_engine.render

  STDOUT.print output
  STDOUT.print SEPARATOR
rescue StandardError => e
  STDOUT.print ERROR_PREFIX
  STDOUT.puts e.to_s
  STDOUT.print SEPARATOR
end

begin
  loop do
    line = STDIN.gets
    compile line[0...-1]
  end
rescue Interrupt
end
