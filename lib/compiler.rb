require 'haml'
require 'haml/exec'

# Don't buffer any output
$stdout.sync = true
$stderr.sync = true

# Signals the parent process that loading 'haml' worked
STDOUT.print '**'

ERROR_PREFIX = "error:\n".freeze
# Reads a random separator
SEPARATOR = STDIN.gets

class Context
  def noop(*_args)
    '<noop></noop>'
  end
end

def setup_context
  methods_header = STDIN.gets

  raise 'karma-ng-hamlt2js internal error: expecting METHODS' if methods_header != "METHODS:\n"

  loop do
    method_name = STDIN.gets
    break if method_name == SEPARATOR
    method_name = method_name[0...-1]
    Context.send(:define_method, method_name, Context.instance_method(:noop))
  end
end

def compile(file_path)
  template = File.read file_path
  haml_engine = Haml::Engine.new template
  output = haml_engine.render(Context.new)

  STDOUT.print output
  STDOUT.print SEPARATOR
rescue StandardError => e
  STDOUT.print ERROR_PREFIX
  STDOUT.puts e.to_s
  STDOUT.print SEPARATOR
end

begin
  setup_context

  loop do
    line = STDIN.gets
    compile line[0...-1]
  end
rescue Interrupt
end
