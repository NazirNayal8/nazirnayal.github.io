# based on https://distresssignal.org/busting-css-cache-with-jekyll-md5-hash
# https://gist.github.com/BryanSchuetz/2ee8c115096d7dd98f294362f6a667db
module Jekyll
  module CacheBust
    require 'digest/md5'

    # main.css is compiled from these sources, so its URL must change whenever any of them does.
    # (The previous version hashed "assets/_sass", which does not exist: the hash was the MD5 of
    # an empty string on every build, and browsers kept serving an outdated stylesheet.)
    CSS_SOURCES = ['_sass/**/*', 'assets/css/main.scss'].freeze

    # The stylesheet digest is computed once per build, not once per page.
    @css_digests = {}
    class << self
      attr_reader :css_digests
    end
    Jekyll::Hooks.register :site, :post_read do |_site|
      CacheBust.css_digests.clear
    end

    def bust_file_cache(file_name)
      [file_name, '?', Digest::MD5.hexdigest(File.read(local_path(file_name)))].join
    end

    def bust_css_cache(file_name)
      source = site_source
      digest = CacheBust.css_digests[source] ||= begin
        files = CSS_SOURCES.flat_map { |pattern| Dir[File.join(source, pattern)] }.select { |f| File.file?(f) }.sort
        raise "cache-bust: no stylesheet sources found under #{source}" if files.empty?
        Digest::MD5.hexdigest(files.map { |f| File.read(f) }.join)
      end
      [file_name, '?', digest].join
    end

    private

    def site_source
      @context.registers[:site].source
    end

    def local_path(file_name)
      File.join(site_source, file_name.slice(file_name.index('assets/')..-1))
    end
  end
end

Liquid::Template.register_filter(Jekyll::CacheBust)
